import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { authOptions } from "./auth-options";
import { db } from "./db";

const options = authOptions(db);

// The app's Better Auth instance, mounted at /api/auth (app/api/auth/[...all]/route.ts).
// To find out who is signed in, use getUserId from lib/session.ts instead.
export const auth = betterAuth({
  ...options,
  // Lets server actions set the session cookie; must stay the last plugin.
  plugins: [...options.plugins, nextCookies()],
});
