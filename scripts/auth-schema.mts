// Config entry for the Better Auth CLI (`npm run db:auth-schema`). The CLI cannot
// load lib/auth.ts, because lib/db.ts imports server-only; generating the schema
// needs the adapter but never touches the database, so an in-memory one will do.
import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/libsql";
import { authOptions } from "../lib/auth-options";

export const auth = betterAuth(
  authOptions(drizzle({ connection: { url: ":memory:" } })),
);
