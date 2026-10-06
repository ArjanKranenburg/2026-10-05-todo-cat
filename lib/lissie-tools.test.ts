import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { A2uiMessageListSchema, BASIC_COMPONENTS } from "@a2ui/web_core/v0_9";
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
import { LISSIE_CATALOG_ID, lissieCatalogDefinitions } from "./lissie-catalog";
import { PROGRESS_CARD } from "./lissie-progress";

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

describe("showProgress", () => {
  // The contract of every component the card may use: the basic catalog's,
  // overridden by Lissie's catalog, as in the chat (components/chat).
  const catalog = new Map<string, { safeParse(value: unknown): unknown }>([
    ...BASIC_COMPONENTS.map((api) => [api.name, api.schema] as const),
    ...Object.entries(lissieCatalogDefinitions).map(
      ([name, definition]) => [name, definition.props] as const,
    ),
  ]);

  /**
   * Checks the operations of one card the way a renderer needs them, and
   * returns its surface's components and data model.
   */
  function expectWellFormedCard(result: unknown) {
    const operations = A2uiMessageListSchema.parse(
      (result as { a2ui_operations: unknown }).a2ui_operations,
    );
    const [create, update, data] = operations;
    if (
      !("createSurface" in create) ||
      !("updateComponents" in update) ||
      !("updateDataModel" in data)
    ) {
      throw new Error(`not a new surface: ${JSON.stringify(operations)}`);
    }
    expect(operations).toHaveLength(3);
    const { surfaceId, catalogId } = create.createSurface;
    expect(catalogId).toBe(LISSIE_CATALOG_ID);
    expect(update.updateComponents.surfaceId).toBe(surfaceId);
    expect(data.updateDataModel).toMatchObject({ surfaceId, path: "/" });

    const { components } = update.updateComponents;
    const ids = components.map((component) => component.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("root");
    for (const { id, component, ...props } of components) {
      const schema = catalog.get(component);
      expect(schema, `${id}: unknown component ${component}`).toBeDefined();
      expect(schema?.safeParse(props), id).toMatchObject({ success: true });
      // Every child it names exists.
      const children = [props.child, props.children].flat();
      for (const child of children.filter((c) => typeof c === "string")) {
        expect(ids, `${id} → ${child}`).toContain(child);
      }
    }
    return { components, model: data.updateDataModel.value };
  }

  /** Every data model path the components read, bound or interpolated. */
  function boundPaths(components: unknown): string[] {
    const json = JSON.stringify(components);
    return [
      ...[...json.matchAll(/"path":"([^"]+)"/g)].map((match) => match[1]),
      ...[...json.matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1]),
    ];
  }

  test("returns a well-formed A2UI card whose numbers are the user's rows", async () => {
    const milk = await service.addTodo(alice, { title: "buy milk" });
    await service.addTodo(alice, { title: "feed the cat" });
    await service.addTodo(alice, { title: "nap" });
    await service.updateTodo(alice, milk.id, { done: true });
    await service.addTodo(bob, { title: "Bob's only to-do" });

    const card = expectWellFormedCard(
      await execute(tools.showProgress, {}, signedIn(alice)),
    );

    expect(card.model).toEqual({ total: 3, done: 1, open: 2 });
    for (const path of boundPaths(card.components)) {
      expect(card.model, path).toHaveProperty(path.slice(1).split("/"));
    }
  });

  test("binds the numbers through the data model: the tree is the same for every list", async () => {
    await service.addTodo(bob, { title: "Bob's only to-do" });

    const empty = expectWellFormedCard(
      await execute(tools.showProgress, {}, signedIn(alice)),
    );
    const bobs = expectWellFormedCard(
      await execute(tools.showProgress, {}, signedIn(bob)),
    );

    expect(empty.model).toEqual({ total: 0, done: 0, open: 0 });
    expect(bobs.model).toEqual({ total: 1, done: 0, open: 1 });
    expect(empty.components).toEqual(PROGRESS_CARD);
    expect(bobs.components).toEqual(PROGRESS_CARD);
    expect(JSON.stringify(PROGRESS_CARD)).not.toMatch(/\d/);
  });

  test("takes no input, so no owner either", async () => {
    await service.addTodo(bob, { title: "Bob's only to-do" });

    const result = await execute(
      tools.showProgress,
      { userId: bob },
      signedIn(alice),
    );

    expect(result).toMatchObject({ error: true });
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
  await expect(execute(tools.showProgress, {}, anonymous)).rejects.toThrow(
    "without a signed-in user",
  );
  expect(await titles(alice)).toEqual([]);
});
