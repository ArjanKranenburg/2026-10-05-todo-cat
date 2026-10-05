import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-todo-service-test-"));
const url = `file:${join(dir, "test.db")}`;

let db: typeof import("./db")["db"];
let schema: typeof import("./schema");
let service: typeof import("./todo-service");

// Every use case runs with two users: alice acts, bob must stay unaffected
// (and vice versa), and neither can tell the other's ids from missing ones.
const alice = "user-alice";
const bob = "user-bob";

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

const notFound = { name: "TodoError", code: "todo-not-found" };

describe("addTodo", () => {
  test("creates an open to-do owned by the user", async () => {
    const before = Date.now();
    const todo = await service.addTodo(alice, {
      title: "feed the cat",
      dueDate: "2026-10-06",
    });

    expect(todo).toEqual({
      id: expect.any(String),
      title: "feed the cat",
      dueDate: "2026-10-06",
      done: false,
      createdAt: expect.any(String),
      completedAt: null,
    });
    expect(Date.parse(todo.createdAt)).toBeGreaterThanOrEqual(before);
    expect(await service.listTodos(alice)).toEqual([todo]);
    expect(await service.listTodos(bob)).toEqual([]);
  });

  test("stores no due date when none is given", async () => {
    const todo = await service.addTodo(bob, { title: "buy litter" });

    expect(todo.dueDate).toBeNull();
    expect(await service.listTodos(alice)).toEqual([]);
  });
});

describe("listTodos", () => {
  beforeEach(async () => {
    const day = (n: number) => new Date(Date.UTC(2026, 9, n, 8));
    await service.seedTodos(alice, [
      { title: "Brush the cat", createdAt: day(1) },
      { title: "Vet appointment", dueDate: "2026-10-09", createdAt: day(2) },
      { title: "Buy CAT food", dueDate: "2026-10-07", createdAt: day(3) },
      { title: "Clean litter box", createdAt: day(1), completedAt: day(2) },
    ]);
    await service.seedTodos(bob, [
      { title: "Cat sitter for the weekend", createdAt: day(1) },
      { title: "Done by bob", createdAt: day(1), completedAt: day(3) },
    ]);
  });

  const titles = async (userId: string, filter?: object) =>
    (await service.listTodos(userId, { status: "all", ...filter })).map(
      (todo) => todo.title,
    );

  test("lists open first, then by due date with none last, then oldest first", async () => {
    expect(await titles(alice)).toEqual([
      "Buy CAT food",
      "Vet appointment",
      "Brush the cat",
      "Clean litter box",
    ]);
    expect(await titles(bob)).toEqual([
      "Cat sitter for the weekend",
      "Done by bob",
    ]);
  });

  test("filters by status", async () => {
    expect(await titles(alice, { status: "open" })).toEqual([
      "Buy CAT food",
      "Vet appointment",
      "Brush the cat",
    ]);
    expect(await titles(alice, { status: "done" })).toEqual([
      "Clean litter box",
    ]);
    expect(await titles(bob, { status: "done" })).toEqual(["Done by bob"]);
  });

  test("searches the title case-insensitively within the user's to-dos", async () => {
    expect(await titles(alice, { search: "cat" })).toEqual([
      "Buy CAT food",
      "Brush the cat",
    ]);
    expect(await titles(bob, { search: "cat" })).toEqual([
      "Cat sitter for the weekend",
    ]);
  });

  test("treats LIKE wildcards in the search as plain text", async () => {
    expect(await titles(alice, { search: "%" })).toEqual([]);
    expect(await titles(alice, { search: "_" })).toEqual([]);
  });

  test("combines status and search", async () => {
    expect(await titles(alice, { status: "done", search: "litter" })).toEqual([
      "Clean litter box",
    ]);
    expect(await titles(bob, { status: "done", search: "litter" })).toEqual([]);
  });
});

describe("getTodo", () => {
  test("returns the user's own to-do", async () => {
    const todo = await service.addTodo(alice, { title: "feed the cat" });

    expect(await service.getTodo(alice, todo.id)).toEqual(todo);
  });

  test("reports another user's to-do exactly like a missing one", async () => {
    const todo = await service.addTodo(alice, { title: "feed the cat" });

    const other = service.getTodo(bob, todo.id).catch((error) => error);
    const missing = service.getTodo(bob, "no-such-id").catch((error) => error);

    expect(await other).toMatchObject(notFound);
    expect(await missing).toMatchObject(notFound);
    expect((await other).message).toBe(
      (await missing).message.replace("no-such-id", todo.id),
    );
  });
});

describe("updateTodo", () => {
  test("changes the title and the due date, and clears the due date with null", async () => {
    const todo = await service.addTodo(alice, { title: "vet" });

    const updated = await service.updateTodo(alice, todo.id, {
      title: "vet appointment",
      dueDate: "2026-10-09",
    });
    expect(updated).toEqual({
      ...todo,
      title: "vet appointment",
      dueDate: "2026-10-09",
    });

    const cleared = await service.updateTodo(alice, todo.id, { dueDate: null });
    expect(cleared.dueDate).toBeNull();
    expect(cleared.title).toBe("vet appointment");
  });

  test("done sets completedAt, done again keeps it, reopening clears it", async () => {
    const todo = await service.addTodo(alice, { title: "feed the cat" });
    const before = Date.now();

    const done = await service.updateTodo(alice, todo.id, { done: true });
    expect(done.done).toBe(true);
    expect(Date.parse(done.completedAt ?? "")).toBeGreaterThanOrEqual(before);

    const again = await service.updateTodo(alice, todo.id, {
      done: true,
      title: "feed the cat twice",
    });
    expect(again.completedAt).toBe(done.completedAt);

    const reopened = await service.updateTodo(alice, todo.id, { done: false });
    expect(reopened).toMatchObject({ done: false, completedAt: null });
  });

  test("an empty patch returns the to-do unchanged", async () => {
    const todo = await service.addTodo(alice, { title: "feed the cat" });

    expect(await service.updateTodo(alice, todo.id, {})).toEqual(todo);
    await expect(service.updateTodo(bob, todo.id, {})).rejects.toMatchObject(
      notFound,
    );
  });

  test("cannot change another user's to-do", async () => {
    const todo = await service.addTodo(alice, { title: "feed the cat" });

    await expect(
      service.updateTodo(bob, todo.id, { title: "mine now", done: true }),
    ).rejects.toMatchObject(notFound);
    expect(await service.getTodo(alice, todo.id)).toEqual(todo);
  });

  test("reports a missing to-do", async () => {
    await expect(
      service.updateTodo(alice, "no-such-id", { done: true }),
    ).rejects.toMatchObject(notFound);
  });
});

describe("deleteTodo", () => {
  test("deletes the user's own to-do", async () => {
    const todo = await service.addTodo(alice, { title: "feed the cat" });
    const kept = await service.addTodo(bob, { title: "feed the dog" });

    await service.deleteTodo(alice, todo.id);

    await expect(service.getTodo(alice, todo.id)).rejects.toMatchObject(
      notFound,
    );
    expect(await service.listTodos(bob)).toEqual([kept]);
  });

  test("cannot delete another user's to-do", async () => {
    const todo = await service.addTodo(alice, { title: "feed the cat" });

    await expect(service.deleteTodo(bob, todo.id)).rejects.toMatchObject(
      notFound,
    );
    expect(await service.getTodo(alice, todo.id)).toEqual(todo);
  });

  test("reports a missing or already deleted to-do", async () => {
    const todo = await service.addTodo(alice, { title: "feed the cat" });
    await service.deleteTodo(alice, todo.id);

    await expect(service.deleteTodo(alice, todo.id)).rejects.toMatchObject(
      notFound,
    );
  });
});

describe("seedTodos", () => {
  test("replaces only the user's to-dos and keeps the timestamps", async () => {
    await service.addTodo(alice, { title: "old" });
    const bobs = await service.addTodo(bob, { title: "bob's" });
    const createdAt = new Date("2026-09-21T07:30:00.000Z");
    const completedAt = new Date("2026-09-22T18:00:00.000Z");

    const seeded = await service.seedTodos(alice, [
      { title: "seeded", dueDate: "2026-09-30", createdAt, completedAt },
    ]);

    expect(seeded).toEqual([
      {
        id: expect.any(String),
        title: "seeded",
        dueDate: "2026-09-30",
        done: true,
        createdAt: createdAt.toISOString(),
        completedAt: completedAt.toISOString(),
      },
    ]);
    expect(await service.listTodos(alice)).toEqual(seeded);
    expect(await service.listTodos(bob)).toEqual([bobs]);
  });
});

describe("the todos table", () => {
  test("deleting a user deletes their to-dos and nobody else's", async () => {
    await service.addTodo(alice, { title: "feed the cat" });
    const bobs = await service.addTodo(bob, { title: "feed the dog" });

    await db.delete(schema.user).where(eq(schema.user.id, alice));

    expect(await db.select().from(schema.todos)).toHaveLength(1);
    expect(await service.listTodos(bob)).toEqual([bobs]);
  });

  test("rejects a due date that is not a calendar day", async () => {
    await expect(
      service.addTodo(alice, { title: "vet", dueDate: "2026-02-30" }),
    ).rejects.toThrow();
  });
});
