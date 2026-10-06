import { describe, expect, test } from "vitest";
import { describeToolCall } from "./lissie-tool-calls";

// Most cases only care about the text.
const textOf = (...args: Parameters<typeof describeToolCall>) =>
  describeToolCall(...args).text;

const todo = {
  id: "todo-1",
  title: "feed the cat",
  dueDate: null,
  done: true,
  createdAt: "2026-10-06T08:00:00.000Z",
  completedAt: "2026-10-06T09:00:00.000Z",
};
const notFound = {
  error: { code: "todo-not-found", message: "There is no to-do with id x." },
};

describe("describeToolCall", () => {
  test("says what Lissie is doing while a call runs", () => {
    expect(textOf("listTodos", {}, undefined)).toBe(
      "Looking through your list…",
    );
    expect(textOf("addTodo", { title: " buy  milk" }, undefined)).toBe(
      "Adding “buy milk”…",
    );
    expect(textOf("addTodo", {}, undefined)).toBe("Adding…");
    expect(textOf("setTodoDone", { id: "x", done: true }, undefined)).toBe(
      "Marking a to-do done…",
    );
  });

  test("says what she did, from JSON text or an object", () => {
    const added = {
      ...todo,
      done: false,
      completedAt: null,
      dueDate: "2026-10-07",
    };
    expect(textOf("addTodo", {}, JSON.stringify(added))).toBe(
      "Added “feed the cat”, due 2026-10-07",
    );
    expect(textOf("setTodoDone", {}, todo)).toBe("Marked “feed the cat” done");
    expect(
      textOf("setTodoDone", {}, { ...todo, done: false, completedAt: null }),
    ).toBe("Reopened “feed the cat”");
  });

  test("counts what a list call found", () => {
    const todos = [{ ...todo, done: false, completedAt: null }, todo];
    expect(textOf("listTodos", {}, { todos })).toBe(
      "Looked through your list: 1 open, 1 done",
    );
    expect(
      textOf(
        "listTodos",
        { status: "open", search: "cat" },
        {
          todos: todos.slice(0, 1),
        },
      ),
    ).toBe("Looked through your open to-dos for “cat”: 1 open");
  });

  test("leaves the progress numbers to the card", () => {
    const card = { a2ui_operations: [{ version: "v0.9" }] };
    expect(textOf("showProgress", {}, undefined)).toBe("Counting your list…");
    expect(textOf("showProgress", {}, JSON.stringify(card))).toBe(
      "Counted your list",
    );
    expect(textOf("showProgress", {}, { error: true, message: "…" })).toBe(
      "Could not count your list: the request did not fit the list's rules.",
    );
  });

  test("tells running, done and failed calls apart", () => {
    expect(describeToolCall("addTodo", {}, undefined).outcome).toBe("running");
    expect(describeToolCall("setTodoDone", {}, todo).outcome).toBe("done");
    expect(describeToolCall("setTodoDone", {}, notFound).outcome).toBe(
      "failed",
    );
  });

  test("says why a call failed", () => {
    expect(textOf("setTodoDone", {}, JSON.stringify(notFound))).toBe(
      "Could not change that to-do: There is no to-do with id x.",
    );
    expect(textOf("addTodo", {}, { error: true, message: "Tool input…" })).toBe(
      "Could not add that to-do: the request did not fit the list's rules.",
    );
  });
});
