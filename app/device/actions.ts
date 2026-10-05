"use server";

import { headers } from "next/headers";
import { decideDeviceCode } from "@/lib/device";

export type DeviceDecisionState = {
  result: "approved" | "denied" | null;
  error: string | null;
};

/** Approves or denies the code in `user_code`, depending on the button pressed. */
export async function decideDevice(
  _state: DeviceDecisionState,
  formData: FormData,
): Promise<DeviceDecisionState> {
  const userCode = formData.get("user_code");
  const approve = formData.get("decision") === "approve";
  const error = await decideDeviceCode(
    await headers(),
    typeof userCode === "string" ? userCode : "",
    approve,
  );
  if (error) return { result: null, error };
  return { result: approve ? "approved" : "denied", error: null };
}
