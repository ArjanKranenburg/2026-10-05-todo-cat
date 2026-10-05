import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ErrorBody, Todo, TodoList } from "@todo-cat/contract";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// Calls the REST route handlers (this folder and [id]/) directly, on a migrated
// temp database, with real session tokens from the app's own /api/auth route.

const dir = mkdtempSync(join(tmpdir(), "todo-cat-rest-test-"));
const url = `file:${join(dir, "test.db")}`;
const origin = "http://localhost:3000";

let db: typeof import("@/lib/db")["db"];
let authRoute: typeof import("../auth/[...all]/route");
let todosRoute: typeof import("./route");
let todoRoute: typeof import("./[id]/route");

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
  vi.stubEnv("BETTER_AUTH_URL", origin);
  ({ db } = await import("@/lib/db"));
  authRoute = await import("../auth/[...all]/route");
  todosRoute = await import("./route");
  todoRoute = await import("./[id]/route");
}, 60_000);

afterAll(() => {
  db?.$client.close();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

/** Signs up through /api/auth like the curl recipe and returns the bearer token. */
async function signUp(name: string): Promise<string> {
  const response = await authRoute.POST(
    new Request(`${origin}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email: `${name.toLowerCase()}@example.com`,
        password: "tuna-o-clock",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const token = response.headers.get("set-auth-token");
  if (!token) throw new Error("sign-up returned no set-auth-token header");
  return token;
}

interface Call {
  token?: string;
  query?: string;
  body?: unknown;
}

function request(method: string, path: string, { token, body }: Call) {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}${path}`, {
    method,
    headers,
    body:
      body === undefined || typeof body === "string"
        ? body
        : JSON.stringify(body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

const api = {
  list: (call: Call = {}) =>
    todosRoute.GET(request("GET", `/api/todos${call.query ?? ""}`, call)),
  add: (call: Call) => todosRoute.POST(request("POST", "/api/todos", call)),
  get: (id: string, call: Call = {}) =>
    todoRoute.GET(request("GET", `/api/todos/${id}`, call), context(id)),
  update: (id: string, call: Call) =>
    todoRoute.PATCH(request("PATCH", `/api/todos/${id}`, call), context(id)),
  delete: (id: string, call: Call = {}) =>
    todoRoute.DELETE(request("DELETE", `/api/todos/${id}`, call), context(id)),
};

async function errorCode(response: Response) {
  return ErrorBody.parse(await response.json()).error.code;
}

describe("without a valid token", () => {
  const someId = "00000000-0000-4000-8000-000000000000";
  const endpoints = [
    ["GET /api/todos", (call: Call) => api.list(call)],
    [
      "POST /api/todos",
      (call: Call) => api.add({ ...call, body: { title: "feed the cat" } }),
    ],
    ["GET /api/todos/:id", (call: Call) => api.get(someId, call)],
    [
      "PATCH /api/todos/:id",
      (call: Call) => api.update(someId, { ...call, body: { done: true } }),
    ],
    ["DELETE /api/todos/:id", (call: Call) => api.delete(someId, call)],
  ] as const;

  test.each(endpoints)("%s answers 401 without a token", async (_, call) => {
    const response = await call({});

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(await errorCode(response)).toBe("unauthorized");
  });

  test.each(endpoints)(
    "%s answers 401 with an invalid token",
    async (_, call) => {
      const response = await call({ token: "not-a-session" });

      expect(response.status).toBe(401);
      expect(await errorCode(response)).toBe("unauthorized");
    },
  );
});

describe("with a bearer token", () => {
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    alice = await signUp("Alice");
    bob = await signUp("Bob");
  });

  const titles = async (token: string, query: string) =>
    TodoList.parse(await (await api.list({ token, query })).json()).map(
      (todo) => todo.title,
    );

  test("adds a to-do, lists it, marks it done, filters, and deletes it", async () => {
    const added = await api.add({
      token: alice,
      body: { title: "  feed   the cat ", dueDate: "2026-10-06" },
    });
    expect(added.status).toBe(201);
    const todo = Todo.parse(await added.json());
    expect(todo).toMatchObject({
      title: "feed the cat",
      dueDate: "2026-10-06",
      done: false,
      completedAt: null,
    });
    expect(added.headers.get("location")).toBe(`/api/todos/${todo.id}`);
    await api.add({ token: alice, body: { title: "brush the cat" } });

    const listed = await api.list({ token: alice });
    expect(listed.status).toBe(200);
    expect(TodoList.parse(await listed.json())).toContainEqual(todo);

    const updated = await api.update(todo.id, {
      token: alice,
      body: { done: true },
    });
    expect(updated.status).toBe(200);
    const done = Todo.parse(await updated.json());
    expect(done).toMatchObject({ id: todo.id, done: true });
    expect(done.completedAt).not.toBeNull();

    expect(await titles(alice, "?status=done")).toEqual(["feed the cat"]);
    expect(await titles(alice, "?status=open")).toEqual(["brush the cat"]);
    expect(await titles(alice, "?search=FEED")).toEqual(["feed the cat"]);
    expect(await titles(alice, "?status=open&search=feed")).toEqual([]);
    expect(await titles(bob, "")).toEqual([]);

    const fetched = await api.get(todo.id, { token: alice });
    expect(fetched.status).toBe(200);
    expect(Todo.parse(await fetched.json())).toEqual(done);

    const deleted = await api.delete(todo.id, { token: alice });
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");
    expect(await titles(alice, "")).toEqual(["brush the cat"]);

    const gone = await api.get(todo.id, { token: alice });
    expect(gone.status).toBe(404);
    expect(await errorCode(gone)).toBe("todo-not-found");
  });

  test("another user's to-do id answers 404 and stays unchanged", async () => {
    const added = await api.add({ token: alice, body: { title: "vet" } });
    const todo = Todo.parse(await added.json());

    for (const response of [
      await api.get(todo.id, { token: bob }),
      await api.update(todo.id, { token: bob, body: { done: true } }),
      await api.delete(todo.id, { token: bob }),
    ]) {
      expect(response.status).toBe(404);
      expect(await errorCode(response)).toBe("todo-not-found");
    }
    const unchanged = await api.get(todo.id, { token: alice });
    expect(Todo.parse(await unchanged.json())).toEqual(todo);
  });

  test.each([
    ["an empty title", () => api.add({ token: alice, body: { title: " " } })],
    [
      "an unknown field",
      () => api.add({ token: alice, body: { title: "vet", complete: true } }),
    ],
    [
      "a due date that is not a day",
      () => api.add({ token: alice, body: { title: "vet", dueDate: "soon" } }),
    ],
    ["a body that is not JSON", () => api.add({ token: alice, body: "{" })],
    ["an empty patch", () => api.update("any-id", { token: alice, body: {} })],
    [
      "an unknown status",
      () => api.list({ token: alice, query: "?status=later" }),
    ],
  ])("%s answers 400 validation-failed", async (_, call) => {
    const response = await call();

    expect(response.status).toBe(400);
    const body = ErrorBody.parse(await response.json());
    expect(body.error.code).toBe("validation-failed");
    expect(body.error.message).not.toBe("");
  });
});
