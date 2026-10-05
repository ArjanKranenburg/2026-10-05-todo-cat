import "server-only";
import { auth } from "./auth";

/**
 * The id of the user a request is signed in as, or null.
 *
 * Accepts the session cookie (browser) or `Authorization: Bearer <session token>`
 * (REST API, CLI). Every adapter authenticates through this function; nothing
 * else reads sessions. Pass `await headers()` in Server Components and Server
 * Functions, `request.headers` in Route Handlers.
 */
export async function getUserId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
