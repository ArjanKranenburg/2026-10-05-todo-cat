import type { Todo } from "@todo-cat/contract";

function TodoSection({
  title,
  todos,
  empty,
}: {
  title: string;
  todos: Todo[];
  empty: string;
}) {
  const id = `todo-section-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2
        id={id}
        className="text-xs font-semibold tracking-wide text-muted uppercase"
      >
        {title} <span className="font-normal">({todos.length})</span>
      </h2>
      {todos.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {todos.map((todo) => (
            <li key={todo.id} className="flex flex-col text-sm leading-5">
              <span
                className={todo.done ? "text-muted line-through" : undefined}
              >
                {todo.title}
              </span>
              {todo.dueDate && !todo.done && (
                <span className="text-xs text-muted">due {todo.dueDate}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The user's to-dos next to the chat, open and done, read-only: in the
 * browser Lissie is the only way to change them. The page renders it on the
 * server and refreshes it when one of her tool calls changed the list
 * (components/chat/lissie-tool-calls.tsx).
 */
export function TodoSidebar({ todos }: { todos: Todo[] }) {
  return (
    <aside
      aria-label="Your to-dos"
      className="flex max-h-32 shrink-0 flex-col gap-6 overflow-y-auto rounded-lg border border-line p-4 md:max-h-none md:w-72"
    >
      <TodoSection
        title="Open"
        todos={todos.filter((todo) => !todo.done)}
        empty="Nothing open. Suspicious."
      />
      <TodoSection
        title="Done"
        todos={todos.filter((todo) => todo.done)}
        empty="Nothing done yet."
      />
    </aside>
  );
}
