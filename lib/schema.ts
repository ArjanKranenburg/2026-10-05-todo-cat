// Drizzle schema: every table is defined or re-exported here, and drizzle-kit diffs it to generate migrations.
// Better Auth's tables are generated into auth-schema.ts (`npm run db:auth-schema`); do not edit that file by hand.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

// Only lib/todo-service.ts reads or writes this table.
export const todos = sqliteTable(
  "todos",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // The owner; every query filters by it.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // A calendar day as `yyyy-mm-dd` text, never a timestamp.
    dueDate: text("due_date"),
    done: integer("done", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("todos_user_id_idx").on(table.userId),
    check(
      "todos_due_date_is_a_day",
      sql`${table.dueDate} is null or date(${table.dueDate}) = ${table.dueDate}`,
    ),
    check(
      "todos_completed_at_iff_done",
      sql`(${table.done} = 1) = (${table.completedAt} is not null)`,
    ),
  ],
);
