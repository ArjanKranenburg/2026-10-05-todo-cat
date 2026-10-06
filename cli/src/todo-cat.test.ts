import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Todo, TodoList } from "@todo-cat/contract";
import { betterAuth } from "better-auth";
import { type TestHelpers, testUtils } from "better-auth/plugins";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { CliErrorCode } from "./errors";

// Drives the built CLI (the `todo-cat` bin) end to end against a real
// `next dev` server on a spare port, with a temp database and a temp config
// directory. The device code is approved through Better Auth's test utils on
// the same database, so no browser is involved.

const root = fileURLToPath(new URL("../..", import.meta.url));
const bin = join(root, "node_modules", ".bin", "todo-cat");
const dir = mkdtempSync(join(tmpdir(), "todo-cat-cli-test-"));
const databaseUrl = `file:${join(dir, "test.db")}`;
const configDir = join(dir, "config");
const credentialsFile = join(configDir, "credentials.json");
const secret = "test-secret-that-is-at-least-32-characters";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

let serverUrl: string;
let stopServer: () => void = () => {};
let db: typeof import("@/lib/db")["db"];
let auth: ReturnType<typeof createTestAuth>;
let helpers: TestHelpers;

function createTestAuth(
  options: ReturnType<typeof import("@/lib/auth-options")["authOptions"]>,
) {
  return betterAuth({ ...options, plugins: [...options.plugins, testUtils()] });
}

/** Starts `next dev` with its own output dir and database; resolves once it answers. */
async function startServer(port: number): Promise<void> {
  const child = spawn(
    join(root, "node_modules", ".bin", "next"),
    ["dev", "--port", String(port)],
    {
      cwd: root,
      detached: true, // its own process group, so stopServer reaches its workers
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // What `next dev` expects; Vitest's NODE_ENV=test confuses Next.
        NODE_ENV: "development",
        NEXT_DIST_DIR: ".next-e2e-cli",
        NEXT_TELEMETRY_DISABLED: "1",
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_URL: serverUrl,
        BETTER_AUTH_SECRET: secret,
      },
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  stopServer = () => {
    if (child.pid && child.exitCode === null) process.kill(-child.pid);
  };
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`next dev exited early:\n${output}`);
    }
    const ok = await fetch(`${serverUrl}/api/auth/ok`).then(
      (response) => response.ok,
      () => false,
    );
    if (ok) {
      // `next dev` compiles a route on its first request; do it here for the
      // routes the CLI calls, not inside a test's 5-second budget.
      for (const path of ["/api/todos", `/api/todos/${randomUUID()}`]) {
        await fetch(`${serverUrl}${path}`);
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`next dev did not answer within 2 minutes:\n${output}`);
}

interface Result {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Every output of the CLI, to check that the token never shows up. */
const outputs: string[] = [];

function startCli(args: string[]) {
  const child = spawn(bin, args, {
    env: {
      ...process.env,
      // With NO_COLOR also set, Node warns about it on stderr and breaks --json parsing.
      FORCE_COLOR: undefined,
      TODO_CAT_URL: serverUrl,
      TODO_CAT_CONFIG_DIR: configDir,
    },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const done = new Promise<Result>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      outputs.push(stdout, stderr);
      resolve({ code, stdout, stderr });
    });
  });
  return { done, stderr: () => stderr };
}

const cli = (...args: string[]) => startCli(args).done;

/** The code of a --json error: the API's codes plus the CLI's own. */
function errorCode(result: Result): CliErrorCode {
  return JSON.parse(result.stderr).error.code;
}

beforeAll(async () => {
  execFileSync("npm", ["run", "--silent", "build", "-w", "todo-cat-cli"], {
    cwd: root,
    stdio: "pipe",
  });
  // Same command as `npm run db:migrate`; the env var wins over .env.
  execFileSync("npm", ["run", "--silent", "db:migrate"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  const port = await freePort();
  serverUrl = `http://localhost:${port}`;
  await startServer(port);

  vi.stubEnv("DATABASE_URL", databaseUrl);
  vi.stubEnv("BETTER_AUTH_SECRET", secret);
  vi.stubEnv("BETTER_AUTH_URL", serverUrl);
  ({ db } = await import("@/lib/db"));
  const { authOptions } = await import("@/lib/auth-options");
  auth = createTestAuth(authOptions(db));
  helpers = (await auth.$context).test;
}, 180_000);

afterAll(() => {
  stopServer();
  db?.$client.close();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("todo-cat against a real server", () => {
  let token: string;

  test("login prints a code, waits for approval, and stores the token", async () => {
    const login = startCli(["login", "--json"]);
    let userCode: string | undefined;
    const deadline = Date.now() + 30_000;
    while (!userCode) {
      userCode = login.stderr().match(/one-time code: (\S+)/)?.[1];
      if (Date.now() > deadline) {
        throw new Error(`login printed no code:\n${login.stderr()}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(login.stderr()).toContain(`${serverUrl}/device?user_code=`);

    const user = await helpers.saveUser(
      helpers.createUser({ name: "Lissie", email: "lissie@example.com" }),
    );
    const headers = await helpers.getAuthHeaders({ userId: user.id });
    await auth.api.deviceVerify({ query: { user_code: userCode }, headers });
    await auth.api.deviceApprove({ body: { userCode }, headers });

    const result = await login.done;
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      server: serverUrl,
      user: { id: user.id, name: "Lissie", email: "lissie@example.com" },
    });
    if (process.platform !== "win32") {
      expect(statSync(credentialsFile).mode & 0o777).toBe(0o600);
      expect(statSync(configDir).mode & 0o777).toBe(0o700);
    }
    token = JSON.parse(readFileSync(credentialsFile, "utf8")).servers[serverUrl]
      .token;
    expect(token).toEqual(expect.any(String));
  }, 60_000);

  test("whoami names the user", async () => {
    const result = await cli("whoami");

    expect(result).toMatchObject({
      code: 0,
      stdout: `Logged in to ${serverUrl} as Lissie <lissie@example.com>.\n`,
    });
  });

  test("add, list, done and delete a to-do", async () => {
    const added = await cli(
      "add",
      "feed",
      "the cat",
      "--due",
      "2026-10-06",
      "--json",
    );
    expect(added.code).toBe(0);
    const todo = Todo.parse(JSON.parse(added.stdout));
    expect(todo).toMatchObject({
      title: "feed the cat",
      dueDate: "2026-10-06",
      done: false,
    });

    const listed = await cli("list", "--json");
    expect(listed.code).toBe(0);
    expect(TodoList.parse(JSON.parse(listed.stdout))).toEqual([todo]);
    expect((await cli("list")).stdout).toBe(
      `${todo.id}  [ ] feed the cat  (due 2026-10-06)\n`,
    );

    const done = await cli("done", todo.id, "--json");
    expect(done.code).toBe(0);
    expect(Todo.parse(JSON.parse(done.stdout))).toMatchObject({
      id: todo.id,
      done: true,
    });
    expect((await cli("list")).stdout).toBe("No open to-dos.\n");

    const unconfirmed = await cli("delete", todo.id, "--json");
    expect(unconfirmed.code).toBe(2);
    expect(errorCode(unconfirmed)).toBe("usage");

    const deleted = await cli("delete", todo.id, "--yes", "--json");
    expect(deleted.code).toBe(0);
    expect(JSON.parse(deleted.stdout)).toEqual({ id: todo.id, deleted: true });

    const gone = await cli("show", todo.id, "--json");
    expect(gone.code).toBe(4);
    expect(errorCode(gone)).toBe("todo-not-found");
  });

  test("invalid input fails with validation-failed before any request", async () => {
    const result = await cli("add", "vet", "--due", "tomorrow", "--json");

    expect(result.code).toBe(2);
    expect(errorCode(result)).toBe("validation-failed");
  });

  test("logout revokes the session, and whoami fails afterwards", async () => {
    const result = await cli("logout");
    expect(result).toMatchObject({
      code: 0,
      stdout: `Logged out of ${serverUrl}.\n`,
    });
    expect(() => statSync(credentialsFile)).toThrow();
    const revoked = await fetch(`${serverUrl}/api/todos`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revoked.status).toBe(401);

    const whoami = await cli("whoami", "--json");
    expect(whoami.code).toBe(3);
    expect(errorCode(whoami)).toBe("unauthorized");
  });

  test("never prints the token", () => {
    for (const output of outputs) expect(output).not.toContain(token);
  });
});
