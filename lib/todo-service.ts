import "server-only";
import type {
  CreateTodoInput,
  ErrorCode,
  Todo,
  TodoListFilter,
  UpdateTodoInput,
} from "@todo-cat/contract";
import { and, asc, eq, type SQL, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { db } from "./db";
import { todos } from "./schema";

// The todo service: every todo query and rule (tech-docs/architecture.md).
// Every function takes the owner's user id first and filters by it; another
// user's todo is reported as not found. Input is already parsed with the
// contract schemas by the adapter; this module does not validate it again.

/** A rule violation; adapters map `code` to their protocol. */
export class TodoError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "TodoError";
    this.code = code;
  }
}

function notFound(id: string) {
  return new TodoError("todo-not-found", `There is no to-do with id ${id}.`);
}

function toTodo(row: typeof todos.$inferSelect): Todo {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate,
    done: row.done,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function ownTodo(userId: string, id: string) {
  return and(eq(todos.userId, userId), eq(todos.id, id));
}

/** Open to-dos first, then by due date (none last), then oldest first. */
export async function listTodos(
  userId: string,
  filter: TodoListFilter = { status: "all" },
): Promise<Todo[]> {
  const conditions: SQL[] = [eq(todos.userId, userId)];
  if (filter.status !== "all") {
    conditions.push(eq(todos.done, filter.status === "done"));
  }
  if (filter.search) {
    // instr has no wildcards to escape; lower() folds ASCII letters only.
    conditions.push(
      sql`instr(lower(${todos.title}), lower(${filter.search})) > 0`,
    );
  }
  const rows = await db
    .select()
    .from(todos)
    .where(and(...conditions))
    .orderBy(
      asc(todos.done),
      sql`${todos.dueDate} asc nulls last`,
      asc(todos.createdAt),
      asc(todos.id),
    );
  return rows.map(toTodo);
}

export async function getTodo(userId: string, id: string): Promise<Todo> {
  const [row] = await db.select().from(todos).where(ownTodo(userId, id));
  if (!row) throw notFound(id);
  return toTodo(row);
}

export async function addTodo(
  userId: string,
  input: CreateTodoInput,
): Promise<Todo> {
  const [row] = await db
    .insert(todos)
    .values({
      userId,
      title: input.title,
      dueDate: input.dueDate ?? null,
      createdAt: new Date(),
    })
    .returning();
  return toTodo(row);
}

/** Marking a to-do done sets `completedAt` once; reopening it clears it. */
export async function updateTodo(
  userId: string,
  id: string,
  patch: UpdateTodoInput,
): Promise<Todo> {
  const changes: SQLiteUpdateSetSource<typeof todos> = {};
  if (patch.title !== undefined) changes.title = patch.title;
  if (patch.dueDate !== undefined) changes.dueDate = patch.dueDate;
  if (patch.done !== undefined) {
    changes.done = patch.done;
    // Keep the first completion time when a done to-do is marked done again.
    changes.completedAt = patch.done
      ? sql`coalesce(${todos.completedAt}, ${Date.now()})`
      : null;
  }
  if (Object.keys(changes).length === 0) return getTodo(userId, id);

  const [row] = await db
    .update(todos)
    .set(changes)
    .where(ownTodo(userId, id))
    .returning();
  if (!row) throw notFound(id);
  return toTodo(row);
}

export async function deleteTodo(userId: string, id: string): Promise<void> {
  const deleted = await db
    .delete(todos)
    .where(ownTodo(userId, id))
    .returning({ id: todos.id });
  if (deleted.length === 0) throw notFound(id);
}

/** A to-do with explicit timestamps; it is done when `completedAt` is set. */
export interface SeedTodo {
  title: string;
  dueDate?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}

/**
 * Replaces all of a user's to-dos with the given ones, timestamps included.
 * Only for the dev seed (scripts/db-seed.mts); no adapter exposes it.
 */
export async function seedTodos(
  userId: string,
  seeds: SeedTodo[],
): Promise<Todo[]> {
  await db.transaction(async (tx) => {
    await tx.delete(todos).where(eq(todos.userId, userId));
    if (seeds.length === 0) return;
    await tx.insert(todos).values(
      seeds.map((seed) => ({
        userId,
        title: seed.title,
        dueDate: seed.dueDate ?? null,
        done: seed.completedAt != null,
        createdAt: seed.createdAt,
        completedAt: seed.completedAt ?? null,
      })),
    );
  });
  return listTodos(userId);
}
