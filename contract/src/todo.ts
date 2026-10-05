import { z } from "zod";

// The todo schemas of the server and the CLI, and the source of the REST API's
// OpenAPI document (lib/openapi.ts, tech-docs/rest-api.md). `id` names a
// schema as a component there; `override` describes what JSON Schema cannot
// derive from a transform or refinement, so that the document never rejects
// what the server accepts.

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
  )
  .meta({
    description: `Trimmed, with inner whitespace collapsed to one space; then 1 to ${MAX_TITLE_LENGTH} characters.`,
    // The limits apply after normalization; raw input only needs one character.
    override: { type: "string", minLength: 1 },
  });

/** A calendar day without time, `yyyy-mm-dd`; never converted to a `Date`. */
export const DueDate = z.iso
  .date()
  .meta({ description: "A calendar day without time, yyyy-mm-dd." });

/** A to-do as every adapter returns it. Timestamps are ISO 8601 strings in UTC. */
export const Todo = z
  .object({
    id: z.string(),
    title: z.string(),
    dueDate: DueDate.nullable(),
    done: z.boolean(),
    createdAt: z.iso.datetime(),
    /** Set when the to-do is marked done, null while it is open. */
    completedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "Todo" });
export type Todo = z.infer<typeof Todo>;

/** A list of to-dos, in the order the service returns them. */
export const TodoList = z.array(Todo).meta({ id: "TodoList" });
export type TodoList = z.infer<typeof TodoList>;

export const CreateTodoInput = z
  .strictObject({
    title: TodoTitle,
    dueDate: DueDate.nullish(),
  })
  .meta({ id: "CreateTodoInput" });
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
  })
  .meta({ id: "UpdateTodoInput", override: { minProperties: 1 } });
export type UpdateTodoInput = z.output<typeof UpdateTodoInput>;

export const TodoStatus = z
  .enum(["open", "done", "all"])
  .meta({ id: "TodoStatus" });
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
export const ErrorCode = z
  .enum(["unauthorized", "todo-not-found", "validation-failed"])
  .meta({ id: "ErrorCode" });
export type ErrorCode = z.infer<typeof ErrorCode>;

/** The body of every error response. */
export const ErrorBody = z
  .object({
    error: z.object({ code: ErrorCode, message: z.string() }),
  })
  .meta({ id: "ErrorBody" });
export type ErrorBody = z.infer<typeof ErrorBody>;

/**
 * The message of a `validation-failed` error: one sentence per issue, prefixed
 * with its field path (`title: A to-do needs a title.`).
 */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join(".")}: ${issue.message}`
        : issue.message,
    )
    .join(" ");
}
