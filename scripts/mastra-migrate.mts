// Creates or updates Mastra's memory tables in the database at DATABASE_URL;
// `npm run db:migrate` runs it after the Drizzle migrations. The app itself
// never touches the schema (it builds the same storage with `disableInit`).
import { createClient } from "@libsql/client";
// @next/env is CommonJS without named exports Node can detect.
import nextEnv from "@next/env";
import { mastraStorage } from "../lib/mastra-storage";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

const client = createClient({ url });
try {
  await mastraStorage(client, { disableInit: false }).init();
} finally {
  client.close();
}
