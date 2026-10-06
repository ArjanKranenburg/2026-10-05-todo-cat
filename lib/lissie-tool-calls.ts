import {
  CreateTodoInput,
  ErrorBody,
  Todo,
  TodoList,
  TodoListFilter,
} from "@todo-cat/contract";
import { z } from "zod";

// Lissie's tools as the model and the chat see them (tech-docs/agent.md):
// their names, input and output schemas, and the one line the chat shows for
// a call. No server code here: the chat imports this module too; the tools
// themselves are in lib/lissie-tools.ts.

export const SetTodoDoneInput = z.strictObject({
  id: z.string().min(1).describe("The to-do's id, as listTodos returns it."),
  done: z.boolean().describe("true marks the to-do done, false reopens it."),
});
export type SetTodoDoneInput = z.output<typeof SetTodoDoneInput>;

/** showProgress counts the whole list; there is nothing to choose. */
export const ShowProgressInput = z.strictObject({});

export const ListTodosOutput = z.union([
  z.object({ todos: TodoList }),
  ErrorBody,
]);
export const TodoOutput = z.union([Todo, ErrorBody]);

export const LISSIE_TOOL_INPUTS = {
  listTodos: TodoListFilter,
  addTodo: CreateTodoInput,
  setTodoDone: SetTodoDoneInput,
  showProgress: ShowProgressInput,
};
export type LissieToolName = keyof typeof LISSIE_TOOL_INPUTS;

/** The tools that change the list, after which the chat's sidebar reloads. */
export const LISSIE_WRITE_TOOLS: ReadonlySet<string> = new Set<LissieToolName>([
  "addTodo",
  "setTodoDone",
]);

/** A tool result as it reaches the chat: JSON text, or nothing while the call runs. */
function parseResult(result: unknown): unknown {
  if (typeof result !== "string") return result;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

/**
 * The message of a failed call: the service's `{ error: { code, message } }`,
 * or Mastra's `{ error: true, message }` for input that fails the schema.
 */
function errorMessage(result: unknown): string | undefined {
  const body = ErrorBody.safeParse(result);
  if (body.success) return body.data.error.message;
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    result.error === true
  ) {
    return "the request did not fit the list's rules.";
  }
  return undefined;
}

const quoted = (title: string) => `“${title}”`;

function describeList(args: unknown, result: unknown): string {
  const filter = TodoListFilter.safeParse(args ?? {});
  const search = filter.success ? filter.data.search : undefined;
  const status = filter.success ? filter.data.status : "all";
  const what =
    (status === "all" ? "your list" : `your ${status} to-dos`) +
    (search ? ` for ${quoted(search)}` : "");
  const list = z.object({ todos: TodoList }).safeParse(result);
  if (!list.success) {
    return result === undefined
      ? `Looking through ${what}…`
      : `Looked through ${what}`;
  }
  const open = list.data.todos.filter((todo) => !todo.done).length;
  const done = list.data.todos.length - open;
  const counts =
    status === "open"
      ? `${open} open`
      : status === "done"
        ? `${done} done`
        : `${open} open, ${done} done`;
  return `Looked through ${what}: ${counts}`;
}

function describeAdd(args: unknown, result: unknown): string {
  const todo = Todo.safeParse(result);
  if (todo.success) {
    const due = todo.data.dueDate ? `, due ${todo.data.dueDate}` : "";
    return `Added ${quoted(todo.data.title)}${due}`;
  }
  const input = CreateTodoInput.safeParse(args ?? {});
  const title = input.success ? ` ${quoted(input.data.title)}` : "";
  return `Adding${title}…`;
}

function describeSetDone(args: unknown, result: unknown): string {
  const todo = Todo.safeParse(result);
  if (todo.success) {
    return todo.data.done
      ? `Marked ${quoted(todo.data.title)} done`
      : `Reopened ${quoted(todo.data.title)}`;
  }
  const input = SetTodoDoneInput.safeParse(args ?? {});
  return input.success && !input.data.done
    ? "Reopening a to-do…"
    : "Marking a to-do done…";
}

// The card itself shows the numbers (lib/lissie-progress.ts).
function describeProgress(result: unknown): string {
  return result === undefined ? "Counting your list…" : "Counted your list";
}

const failures: Record<LissieToolName, string> = {
  listTodos: "Could not look through your list",
  addTodo: "Could not add that to-do",
  setTodoDone: "Could not change that to-do",
  showProgress: "Could not count your list",
};

/** A tool call as one line of the chat, and how the call went. */
export interface ToolCallLine {
  text: string;
  outcome: "running" | "done" | "failed";
}

/**
 * The one line the chat shows for a call of one of Lissie's tools: what she
 * is doing while it runs, what she did once it returned, or why it failed.
 * `args` and `result` come from the stream or the replayed history and are
 * checked here, never trusted.
 */
export function describeToolCall(
  name: LissieToolName,
  args: unknown,
  rawResult: unknown,
): ToolCallLine {
  const result = parseResult(rawResult);
  const error = errorMessage(result);
  if (error) return { text: `${failures[name]}: ${error}`, outcome: "failed" };
  const outcome = result === undefined ? "running" : "done";
  switch (name) {
    case "listTodos":
      return { text: describeList(args, result), outcome };
    case "addTodo":
      return { text: describeAdd(args, result), outcome };
    case "setTodoDone":
      return { text: describeSetDone(args, result), outcome };
    case "showProgress":
      return { text: describeProgress(result), outcome };
  }
}
