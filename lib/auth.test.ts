import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { betterAuth } from "better-auth";
import { type TestHelpers, testUtils } from "better-auth/plugins";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-auth-test-"));
const url = `file:${join(dir, "test.db")}`;

// Test-only instance: the app's options plus testUtils(), on the same database
// and secret as lib/auth.ts, so sessions it creates are valid for getUserId.
function createTestAuth(
  options: ReturnType<typeof import("./auth-options")["authOptions"]>,
) {
  return betterAuth({ ...options, plugins: [...options.plugins, testUtils()] });
}

let db: typeof import("./db")["db"];
let auth: ReturnType<typeof createTestAuth>;
let helpers: TestHelpers;
let getUserId: typeof import("./session")["getUserId"];

beforeAll(async () => {
  // Same command as `npm run db:migrate`; the env var wins over .env.
  execFileSync("npm", ["run", "--silent", "db:migrate"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-secret-that-is-at-least-32-characters",
  );
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  ({ db } = await import("./db"));
  const { authOptions } = await import("./auth-options");
  auth = createTestAuth(authOptions(db));
  helpers = (await auth.$context).test;
  ({ getUserId } = await import("./session"));
}, 60_000);

afterAll(() => {
  db?.$client.close();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("email and password", () => {
  const credentials = { email: "lissie@example.com", password: "tuna-o-clock" };

  test("sign-up creates the user", async () => {
    const result = await auth.api.signUpEmail({
      body: { name: "Lissie", ...credentials },
    });

    expect(result.user).toMatchObject({
      name: "Lissie",
      email: credentials.email,
    });
  });

  test("the right password signs in", async () => {
    const result = await auth.api.signInEmail({ body: credentials });

    expect(result.user.email).toBe(credentials.email);
    expect(result.token).toEqual(expect.any(String));
  });

  test("a wrong password is rejected", async () => {
    await expect(
      auth.api.signInEmail({
        body: { ...credentials, password: "not-the-tuna" },
      }),
    ).rejects.toMatchObject({ status: "UNAUTHORIZED" });
  });
});

describe("getUserId", () => {
  let userId: string;

  beforeAll(async () => {
    userId = (await helpers.saveUser(helpers.createUser())).id;
  });

  test("returns the user id for a session cookie", async () => {
    const headers = await helpers.getAuthHeaders({ userId });

    expect(headers.get("cookie")).toContain("session_token");
    expect(await getUserId(headers)).toBe(userId);
  });

  test("returns the user id for a bearer token", async () => {
    const { token } = await helpers.login({ userId });
    const headers = new Headers({ authorization: `Bearer ${token}` });

    expect(await getUserId(headers)).toBe(userId);
  });

  test("returns null without a cookie or token", async () => {
    expect(await getUserId(new Headers())).toBeNull();
  });

  test("returns null for an unknown bearer token", async () => {
    const headers = new Headers({ authorization: "Bearer not-a-session" });

    expect(await getUserId(headers)).toBeNull();
  });
});
