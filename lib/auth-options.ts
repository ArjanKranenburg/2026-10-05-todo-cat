import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { BetterAuthOptions } from "better-auth";
import { bearer, deviceAuthorization } from "better-auth/plugins";
import * as schema from "./schema";

// The only client id the device flow accepts: the todo-cat CLI.
export const CLI_CLIENT_ID = "todo-cat-cli";

// Better Auth options without a database handle, so the app (lib/auth.ts), the
// test-only instance and the schema generator (scripts/auth-schema.ts) share them.
// Secret and base URL come from BETTER_AUTH_SECRET and BETTER_AUTH_URL.
export function authOptions(db: Parameters<typeof drizzleAdapter>[0]) {
  return {
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true },
    plugins: [
      // The REST API and the CLI send `Authorization: Bearer <session token>`.
      bearer(),
      // `todo-cat login` gets a session token like `gh auth login` (RFC 8628).
      deviceAuthorization({
        verificationUri: "/device",
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
    ],
  } satisfies BetterAuthOptions;
}
