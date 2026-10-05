import type { Todo, TodoListFilter } from "@todo-cat/contract";
import type { Account } from "./auth";

// Human-readable text output; --json prints the contract types instead.

/**
 * Renders one to-do as a checklist line, its id first so it can be copied into
 * the next command: `<id>  [x] feed the cat  (due 2026-10-06)`.
 */
export function formatTodoLine(
  todo: Pick<Todo, "id" | "title" | "done" | "dueDate">,
): string {
  const due = todo.dueDate ? `  (due ${todo.dueDate})` : "";
  return `${todo.id}  [${todo.done ? "x" : " "}] ${todo.title}${due}`;
}

export function formatTodoList(todos: Todo[], filter: TodoListFilter): string {
  if (todos.length > 0) return todos.map(formatTodoLine).join("\n");
  const which = filter.status === "all" ? "" : `${filter.status} `;
  const matching = filter.search ? ` matching "${filter.search}"` : "";
  return `No ${which}to-dos${matching}.`;
}

export function formatAccount({ server, user }: Account): string {
  return `Logged in to ${server} as ${user.name} <${user.email}>.`;
}
