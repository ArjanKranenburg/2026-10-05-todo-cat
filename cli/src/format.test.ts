import { expect, test } from "vitest";
import { formatTodoLine } from "./format";

test("marks done to-dos with an x", () => {
  expect(formatTodoLine({ title: "feed the cat", done: true })).toBe(
    "[x] feed the cat",
  );
});

test("leaves open to-dos unchecked", () => {
  expect(formatTodoLine({ title: "clean the litter box", done: false })).toBe(
    "[ ] clean the litter box",
  );
});
