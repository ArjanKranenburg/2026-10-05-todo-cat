import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-db-test-"));
const url = `file:${join(dir, "test.db")}`;

let db: typeof import("./db")["db"];

beforeAll(async () => {
  // Same command as `npm run db:migrate`; the env var wins over .env.
  execFileSync("npm", ["run", "--silent", "db:migrate"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  vi.stubEnv("DATABASE_URL", url);
  ({ db } = await import("./db"));
}, 60_000);

afterAll(() => {
  db?.$client.close();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

test("db queries the migrated database", async () => {
  const tables = await db.all<{ name: string }>(
    "select name from sqlite_master where type = 'table'",
  );

  expect(tables.map((table) => table.name)).toContain("__drizzle_migrations");
});
