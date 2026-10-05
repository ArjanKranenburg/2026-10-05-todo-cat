// Deletes the local SQLite database named by DATABASE_URL, including its
// journal files; `npm run db:reset` then migrates a fresh one.
import { rmSync } from "node:fs";
// @next/env is CommonJS without named exports Node can detect.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:")) {
  console.error(`db:reset only deletes local file: databases, got ${url}`);
  process.exit(1);
}

const path = url.slice("file:".length);
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(path + suffix, { force: true });
}
console.log(`Deleted ${path}`);
