import { setTimeout as sleep } from "node:timers/promises";
import { CLI_CLIENT_ID, formatUserCode } from "@todo-cat/contract";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { REQUEST_TIMEOUT_MS } from "./api";
import type { CredentialStore } from "./config";
import { CliError, notLoggedIn, unreachable } from "./errors";

// login, logout and whoami through Better Auth's own client: the device
// authorization flow (RFC 8628) for login, the session endpoints with the
// session token as bearer token for the rest (tech-docs/auth.md).

/** The signed-in user as login and whoami report it. */
export interface Account {
  server: string;
  user: { id: string; name: string; email: string };
}

function authClient(server: string) {
  return createAuthClient({
    baseURL: `${server}/api/auth`,
    plugins: [deviceAuthorizationClient()],
  });
}

function fetchOptions(token?: string) {
  return {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  };
}

/** Runs one auth client call; a failed connection becomes `server-unreachable`. */
async function call<T>(server: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw unreachable(server, error);
  }
}

function unexpected(what: string, error: unknown): CliError {
  const detail =
    (error as { error_description?: string; message?: string } | null)
      ?.error_description ??
    (error as { message?: string } | null)?.message ??
    "no details";
  return new CliError("unexpected-response", `${what} failed: ${detail}`);
}

/**
 * Logs in like `gh auth login`: requests a device code, tells the user where to
 * approve it (via `progress`, never opening a browser), polls until approved,
 * then stores the session token.
 */
export async function login(
  server: string,
  store: CredentialStore,
  progress: (line: string) => void,
): Promise<Account> {
  const client = authClient(server);
  const code = await call(server, () =>
    client.device.code({
      client_id: CLI_CLIENT_ID,
      fetchOptions: fetchOptions(),
    }),
  );
  if (!code.data) throw unexpected("Requesting a login code", code.error);
  const { device_code, user_code, verification_uri_complete } = code.data;
  progress(`First copy your one-time code: ${formatUserCode(user_code)}`);
  progress(
    `Then open ${verification_uri_complete} in a browser to approve it.`,
  );
  progress("Waiting for approval...");

  let interval = code.data.interval;
  let token: string | undefined;
  while (!token) {
    await sleep(interval * 1000);
    const { data, error } = await call(server, () =>
      client.device.token({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code,
        client_id: CLI_CLIENT_ID,
        fetchOptions: fetchOptions(),
      }),
    );
    if (data) {
      token = data.access_token;
      continue;
    }
    switch (error?.error) {
      case "authorization_pending":
        break;
      case "slow_down":
        interval += 5;
        break;
      case "access_denied":
        throw new CliError("login-denied", "The login was denied.");
      case "expired_token":
        throw new CliError(
          "login-expired",
          "The code expired before anyone approved it. Run `todo-cat login` again.",
        );
      default:
        throw unexpected("Logging in", error);
    }
  }

  const account = await whoami(server, token);
  await store.save(server, token);
  return account;
}

/** The user the token belongs to; `unauthorized` if it is missing, expired or revoked. */
export async function whoami(
  server: string,
  token: string | undefined,
): Promise<Account> {
  if (!token) throw notLoggedIn(server);
  const { data, error } = await call(server, () =>
    authClient(server).getSession({ fetchOptions: fetchOptions(token) }),
  );
  if (error) throw unexpected("Reading the session", error);
  if (!data) {
    throw new CliError(
      "unauthorized",
      `The session for ${server} has expired or was revoked. Run \`todo-cat login\` again.`,
    );
  }
  const { id, name, email } = data.user;
  return { server, user: { id, name, email } };
}

/**
 * Revokes the session on the server, then forgets the token. If the server
 * cannot be reached, the token stays so that `logout` can be retried.
 * Returns false if there was no token to begin with.
 */
export async function logout(
  server: string,
  store: CredentialStore,
): Promise<boolean> {
  const token = await store.token(server);
  if (!token) return false;
  const { error } = await call(server, () =>
    authClient(server).signOut({ fetchOptions: fetchOptions(token) }),
  );
  if (error) throw unexpected("Revoking the session", error);
  await store.remove(server);
  return true;
}
