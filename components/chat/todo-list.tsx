"use client";

import type { Todo } from "@todo-cat/contract";
import { useRef, useState, useTransition } from "react";
import {
  addTodoAction,
  deleteTodoAction,
  toggleTodoAction,
} from "@/app/todo-actions";

function CatEye({
  done,
  label,
  onChange,
  disabled,
}: {
  done: boolean;
  label: string;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <input
      type="checkbox"
      checked={done}
      aria-label={label}
      onChange={onChange}
      disabled={disabled}
      className="cat-eye"
    />
  );
}

function TodoItem({
  todo,
  onToggle,
  onDeleteRequest,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  disabled,
}: {
  todo: Todo;
  onToggle: (id: string, done: boolean) => void;
  onDeleteRequest: (id: string) => void;
  confirmDelete: boolean;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  disabled: boolean;
}) {
  return (
    <li className="group flex items-start gap-2.5 py-1.5">
      <CatEye
        done={todo.done}
        label={todo.title}
        onChange={() => onToggle(todo.id, !todo.done)}
        disabled={disabled}
      />
      <div className="min-w-0 flex-1">
        <span
          className={`block text-sm leading-5 break-words ${todo.done ? "text-muted line-through" : ""}`}
        >
          {todo.title}
        </span>
        {todo.dueDate && !todo.done && (
          <span className="text-xs text-muted">due {todo.dueDate}</span>
        )}
      </div>
      {confirmDelete ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onConfirmDelete(todo.id)}
            disabled={disabled}
            className="text-xs font-medium text-danger hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            className="text-xs text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Keep
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onDeleteRequest(todo.id)}
          aria-label={`Delete "${todo.title}"`}
          className="shrink-0 text-muted opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent group-hover:opacity-100"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1m1 0v8a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-8h6Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </li>
  );
}

function TodoSection({
  title,
  todos,
  empty,
  onToggle,
  onDeleteRequest,
  confirmDeleteId,
  onConfirmDelete,
  onCancelDelete,
  disabled,
}: {
  title: string;
  todos: Todo[];
  empty: string;
  onToggle: (id: string, done: boolean) => void;
  onDeleteRequest: (id: string) => void;
  confirmDeleteId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  disabled: boolean;
}) {
  const id = `todo-section-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <h2
        id={id}
        className="mb-1.5 text-xs font-semibold tracking-wide text-muted"
      >
        {title} <span className="font-normal opacity-70">({todos.length})</span>
      </h2>
      {todos.length === 0 ? (
        <p className="text-xs text-muted italic">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onDeleteRequest={onDeleteRequest}
              confirmDelete={confirmDeleteId === todo.id}
              onConfirmDelete={onConfirmDelete}
              onCancelDelete={onCancelDelete}
              disabled={disabled}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function TodoList({ todos }: { todos: Todo[] }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  function handleAdd(formData: FormData) {
    const title = (formData.get("title") as string)?.trim();
    if (!title) return;
    startTransition(async () => {
      await addTodoAction(formData);
      formRef.current?.reset();
    });
  }

  function handleToggle(id: string, done: boolean) {
    startTransition(() => toggleTodoAction(id, done));
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTodoAction(id);
      setConfirmDeleteId(null);
    });
  }

  return (
    <aside
      aria-label="Your to-dos"
      className="flex max-h-48 shrink-0 flex-col gap-5 overflow-y-auto rounded-lg border border-line p-4 md:max-h-none md:w-80"
    >
      <form ref={formRef} action={handleAdd} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            name="title"
            required
            aria-label="To-do title"
            placeholder="What needs doing…"
            autoComplete="off"
            disabled={isPending}
            className="min-w-0 flex-1 rounded-md border border-line bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          />
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 rounded-md border border-line px-3 py-2 text-sm font-medium transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
          >
            Add
          </button>
        </div>
        <input
          name="dueDate"
          type="date"
          aria-label="Due date (optional)"
          disabled={isPending}
          className="w-full rounded-md border border-line bg-background px-3 py-2 text-sm text-muted outline-none transition-colors focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        />
      </form>

      <TodoSection
        title="Open"
        todos={open}
        empty="Nothing open. Suspicious."
        onToggle={handleToggle}
        onDeleteRequest={setConfirmDeleteId}
        confirmDeleteId={confirmDeleteId}
        onConfirmDelete={handleDelete}
        onCancelDelete={() => setConfirmDeleteId(null)}
        disabled={isPending}
      />

      {done.length > 0 && (
        <TodoSection
          title="Done"
          todos={done}
          empty=""
          onToggle={handleToggle}
          onDeleteRequest={setConfirmDeleteId}
          confirmDeleteId={confirmDeleteId}
          onConfirmDelete={handleDelete}
          onCancelDelete={() => setConfirmDeleteId(null)}
          disabled={isPending}
        />
      )}
    </aside>
  );
}
