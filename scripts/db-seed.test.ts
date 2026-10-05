import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-seed-test-"));
const url = `file:${join(dir, "test.db")}`;
const demo = { email: "demo@todo-cat.dev", password: "cat-person-2026" };

let db: typeof import("../lib/db")["db"];
let schema: typeof import("../lib/schema");

// Runs an npm script against the temp database; the env var wins over .env.
function run(script: string) {
  execFileSync("npm", ["run", "--silent", script], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

// The seeded to-dos without their ids, which are new on every run.
async function snapshot() {
  const rows = await db
    .select()
    .from(schema.todos)
    .innerJoin(schema.user, eq(schema.todos.userId, schema.user.id))
    .orderBy(schema.todos.createdAt);
  return rows.map(({ todos: { id, userId, ...todo }, user }) => ({
    ...todo,
    email: user.email,
  }));
}

beforeAll(async () => {
  run("db:migrate");
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-secret-that-is-at-least-32-characters",
  );
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  ({ db } = await import("../lib/db"));
  schema = await import("../lib/schema");
}, 60_000);

afterAll(() => {
  db?.$client.close();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

test("db:seed twice gives the same demo user and to-dos", async () => {
  run("db:seed");
  const first = await snapshot();
  run("db:seed");
  const second = await snapshot();

  expect(second).toEqual(first);
  expect(await db.select().from(schema.user)).toHaveLength(1);
  expect(second.length).toBeGreaterThanOrEqual(10);
  expect(second.every((todo) => todo.email === demo.email)).toBe(true);
  expect(second.some((todo) => todo.done)).toBe(true);
  expect(second.some((todo) => !todo.done)).toBe(true);
  expect(second.some((todo) => todo.dueDate !== null)).toBe(true);

  const twoWeeksAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
  for (const todo of second) {
    expect(todo.createdAt.getTime()).toBeGreaterThan(twoWeeksAgo);
    expect(todo.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
  }
}, 60_000);

test("the demo user signs in with the documented password", async () => {
  const { authOptions } = await import("../lib/auth-options");
  const auth = betterAuth(authOptions(db));

  const result = await auth.api.signInEmail({ body: demo });

  expect(result.user.email).toBe(demo.email);
});
