import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MASTRA_RESOURCE_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

// Lissie's tool executors on a migrated temp database, called the way Mastra
// calls them: input first, the request context the runtime built second.
// As in the service's tests, alice acts and bob must stay unaffected.

const dir = mkdtempSync(join(tmpdir(), "todo-cat-lissie-tools-test-"));
const url = `file:${join(dir, "test.db")}`;

let db: typeof import("./db")["db"];
let schema: typeof import("./schema");
let service: typeof import("./todo-service");
let tools: typeof import("./lissie-tools")["lissieTools"];

const alice = "user-alice";
const bob = "user-bob";

/** What lib/chat-runtime.ts puts into the request context for a signed-in user. */
function signedIn(userId: string): RequestContext {
  return new RequestContext([[MASTRA_RESOURCE_ID_KEY, userId]]);
}

type LissieTool = (typeof tools)[keyof typeof tools];

/**
 * Calls a tool as the agent does: with the model's raw input, which the tool's
 * schema has yet to parse (hence untyped), and the runtime's request context.
 * Mastra adds the rest of the execution context itself.
 */
function execute(
  tool: LissieTool,
  input: Record<string, unknown>,
  requestContext: RequestContext,
): Promise<unknown> {
  return (
    tool.execute?.(input as never, { requestContext } as never) ??
    Promise.reject(new Error(`${tool.id} has no execute`))
  );
}

beforeAll(async () => {
  // Same command as `npm run db:migrate`; the env var wins over .env.
  execFileSync("npm", ["run", "--silent", "db:migrate"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  vi.stubEnv("DATABASE_URL", url);
  ({ db } = await import("./db"));
  schema = await import("./schema");
  service = await import("./todo-service");
  ({ lissieTools: tools } = await import("./lissie-tools"));
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.user);
  await db.insert(schema.user).values([
    { id: alice, name: "Alice", email: "alice@example.com" },
    { id: bob, name: "Bob", email: "bob@example.com" },
  ]);
});

afterAll(() => {
  db?.$client.close();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const titles = async (userId: string) =>
  (await service.listTodos(userId)).map((todo) => todo.title);

describe("addTodo", () => {
  test("adds a to-do to the signed-in user's list only", async () => {
    const todo = await execute(
      tools.addTodo,
      { title: "  buy   milk ", dueDate: "2026-10-07" },
      signedIn(alice),
    );

    expect(todo).toEqual({
      id: expect.any(String),
      title: "buy milk",
      dueDate: "2026-10-07",
      done: false,
      createdAt: expect.any(String),
      completedAt: null,
    });
    expect(await titles(alice)).toEqual(["buy milk"]);
    expect(await titles(bob)).toEqual([]);
  });

  test("takes no owner from the input", async () => {
    const result = await execute(
      tools.addTodo,
      // The model filling in someone else's id: not part of the schema.
      { title: "steal tuna", userId: bob },
      signedIn(alice),
    );

    expect(result).toMatchObject({ error: true });
    expect(await titles(alice)).toEqual([]);
    expect(await titles(bob)).toEqual([]);
  });

  test("rejects what the contract rejects", async () => {
    const result = await execute(
      tools.addTodo,
      { title: "   " },
      signedIn(alice),
    );

    expect(result).toMatchObject({ error: true });
    expect(await titles(alice)).toEqual([]);
  });
});

describe("listTodos", () => {
  test("lists only the signed-in user's to-dos, filtered", async () => {
    const milk = await service.addTodo(alice, { title: "buy milk" });
    const cat = await service.addTodo(alice, { title: "feed the cat" });
    await service.updateTodo(alice, cat.id, { done: true });
    await service.addTodo(bob, { title: "buy milk for Bob" });

    const all = await execute(tools.listTodos, {}, signedIn(alice));
    const open = await execute(
      tools.listTodos,
      { status: "open" },
      signedIn(alice),
    );
    const search = await execute(
      tools.listTodos,
      { search: "MILK" },
      signedIn(alice),
    );

    expect(all).toEqual({
      todos: [milk, expect.objectContaining({ title: "feed the cat" })],
    });
    expect(open).toEqual({ todos: [milk] });
    expect(search).toEqual({ todos: [milk] });
    expect(await execute(tools.listTodos, {}, signedIn(bob))).toEqual({
      todos: [expect.objectContaining({ title: "buy milk for Bob" })],
    });
  });
});

describe("setTodoDone", () => {
  test("marks the user's to-do done and reopens it", async () => {
    const cat = await service.addTodo(alice, { title: "feed the cat" });

    const done = await execute(
      tools.setTodoDone,
      { id: cat.id, done: true },
      signedIn(alice),
    );
    expect(done).toMatchObject({
      id: cat.id,
      done: true,
      completedAt: expect.any(String),
    });

    const reopened = await execute(
      tools.setTodoDone,
      { id: cat.id, done: false },
      signedIn(alice),
    );
    expect(reopened).toMatchObject({ done: false, completedAt: null });
  });

  test("another user's to-do is not found, and stays as it was", async () => {
    const bobs = await service.addTodo(bob, { title: "feed the cat" });

    const result = await execute(
      tools.setTodoDone,
      { id: bobs.id, done: true },
      signedIn(alice),
    );

    expect(result).toEqual({
      error: {
        code: "todo-not-found",
        message: `There is no to-do with id ${bobs.id}.`,
      },
    });
    expect(await service.listTodos(bob)).toEqual([bobs]);
  });
});

test("without a signed-in user in the request context, no tool runs", async () => {
  const anonymous = new RequestContext();

  await expect(
    execute(tools.addTodo, { title: "buy milk" }, anonymous),
  ).rejects.toThrow("without a signed-in user");
  await expect(execute(tools.listTodos, {}, anonymous)).rejects.toThrow(
    "without a signed-in user",
  );
  expect(await titles(alice)).toEqual([]);
});
