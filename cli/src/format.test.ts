import { describe, expect, test } from "vitest";
import { formatTodoLine, formatTodoList } from "./format";

const todo = {
  id: "0b1c",
  title: "feed the cat",
  dueDate: null,
  done: false,
  createdAt: "2026-10-01T08:00:00.000Z",
  completedAt: null,
};

describe("formatTodoLine", () => {
  test("marks done to-dos with an x", () => {
    expect(formatTodoLine({ ...todo, done: true })).toBe(
      "0b1c  [x] feed the cat",
    );
  });

  test("leaves open to-dos unchecked and shows the due date", () => {
    expect(formatTodoLine({ ...todo, dueDate: "2026-10-06" })).toBe(
      "0b1c  [ ] feed the cat  (due 2026-10-06)",
    );
  });
});

describe("formatTodoList", () => {
  test("puts one to-do on each line", () => {
    const other = { ...todo, id: "7f3a", title: "brush the cat" };

    expect(formatTodoList([todo, other], { status: "all" })).toBe(
      "0b1c  [ ] feed the cat\n7f3a  [ ] brush the cat",
    );
  });

  test("says what was filtered when nothing matches", () => {
    expect(formatTodoList([], { status: "open", search: "vet" })).toBe(
      'No open to-dos matching "vet".',
    );
    expect(formatTodoList([], { status: "all" })).toBe("No to-dos.");
  });
});
