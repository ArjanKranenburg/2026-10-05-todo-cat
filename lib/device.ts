import "server-only";
import { CLI_CLIENT_ID } from "@todo-cat/contract";
import { isAPIError } from "better-auth/api";
import { auth } from "./auth";

// The approval side of `todo-cat login`, Better Auth's device authorization
// flow (tech-docs/auth.md). `headers` carry the signed-in user's session.

export type DeviceCodeStatus = "pending" | "approved" | "denied";

export type DeviceCodeCheck =
  | { status: DeviceCodeStatus; client: string }
  | { status: "invalid"; message: string };

/**
 * Looks up a user code and claims it for the signed-in user, which Better Auth
 * requires before that user may approve or deny it.
 */
export async function checkDeviceCode(
  headers: Headers,
  userCode: string,
): Promise<DeviceCodeCheck> {
  try {
    const result = await auth.api.deviceVerify({
      query: { user_code: userCode },
      headers,
    });
    return {
      status: result.status as DeviceCodeStatus,
      client:
        result.client_id === CLI_CLIENT_ID
          ? "the todo-cat CLI"
          : "an unknown app",
    };
  } catch (error) {
    if (isAPIError(error)) {
      return {
        status: "invalid",
        message:
          "This code is unknown or has expired. Run todo-cat login again for a new one.",
      };
    }
    throw error;
  }
}

/** Approves or denies a claimed user code; returns Better Auth's message on failure. */
export async function decideDeviceCode(
  headers: Headers,
  userCode: string,
  approve: boolean,
): Promise<string | null> {
  try {
    const request = { body: { userCode }, headers };
    await (approve
      ? auth.api.deviceApprove(request)
      : auth.api.deviceDeny(request));
    return null;
  } catch (error) {
    if (isAPIError(error)) return error.message;
    throw error;
  }
}
