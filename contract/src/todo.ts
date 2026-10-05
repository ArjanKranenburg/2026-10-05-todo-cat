import { z } from "zod";

export const MAX_TITLE_LENGTH = 200;

/** A to-do title: trimmed, inner whitespace collapsed, 1 to 200 characters. */
export const TodoTitle = z
  .string()
  .transform((raw) => raw.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "A to-do needs a title.")
      .max(
        MAX_TITLE_LENGTH,
        `A to-do title can have at most ${MAX_TITLE_LENGTH} characters.`,
      ),
  );

/** A calendar day without time, `yyyy-mm-dd`; never converted to a `Date`. */
export const DueDate = z.iso.date();

/** A to-do as every adapter returns it. Timestamps are ISO 8601 strings in UTC. */
export const Todo = z.object({
  id: z.string(),
  title: z.string(),
  dueDate: DueDate.nullable(),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
  /** Set when the to-do is marked done, null while it is open. */
  completedAt: z.iso.datetime().nullable(),
});
export type Todo = z.infer<typeof Todo>;

export const CreateTodoInput = z.strictObject({
  title: TodoTitle,
  dueDate: DueDate.nullish(),
});
export type CreateTodoInput = z.output<typeof CreateTodoInput>;

/** A partial update; `dueDate: null` clears the due date. */
export const UpdateTodoInput = z
  .strictObject({
    title: TodoTitle.optional(),
    dueDate: DueDate.nullable().optional(),
    done: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Nothing to update: give a title, a due date, or done.",
  });
export type UpdateTodoInput = z.output<typeof UpdateTodoInput>;

export const TodoStatus = z.enum(["open", "done", "all"]);
export type TodoStatus = z.infer<typeof TodoStatus>;

/** Which to-dos to list: by status, and by text in the title (case-insensitive). */
export const TodoListFilter = z.strictObject({
  status: TodoStatus.default("all"),
  search: z
    .string()
    .trim()
    .transform((search) => search || undefined)
    .optional(),
});
export type TodoListFilter = z.output<typeof TodoListFilter>;

/** Every error code an adapter can return; clients switch on the code, not the message. */
export const ErrorCode = z.enum([
  "unauthorized",
  "todo-not-found",
  "validation-failed",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** The body of every error response. */
export const ErrorBody = z.object({
  error: z.object({ code: ErrorCode, message: z.string() }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
