import { describe, expect, test } from "vitest";
import {
  CreateTodoInput,
  describeIssues,
  ErrorBody,
  MAX_TITLE_LENGTH,
  Todo,
  TodoListFilter,
  UpdateTodoInput,
} from "./index";

describe("CreateTodoInput", () => {
  test("trims the title and collapses whitespace", () => {
    expect(CreateTodoInput.parse({ title: "  feed \t the\n cat  " })).toEqual({
      title: "feed the cat",
    });
  });

  test("rejects a blank title", () => {
    expect(CreateTodoInput.safeParse({ title: "   " }).success).toBe(false);
  });

  test("accepts the maximum title length and rejects one more", () => {
    const at = "a".repeat(MAX_TITLE_LENGTH);
    expect(CreateTodoInput.safeParse({ title: at }).success).toBe(true);
    expect(CreateTodoInput.safeParse({ title: `${at}a` }).success).toBe(false);
  });

  test("accepts a real calendar day as due date", () => {
    expect(
      CreateTodoInput.parse({ title: "vet", dueDate: "2028-02-29" }),
    ).toEqual({ title: "vet", dueDate: "2028-02-29" });
  });

  test.each(["2026-02-30", "2026-1-5", "2026-10-05T00:00:00Z", "tomorrow"])(
    "rejects the due date %s",
    (dueDate) => {
      expect(CreateTodoInput.safeParse({ title: "vet", dueDate }).success).toBe(
        false,
      );
    },
  );

  test("rejects unknown fields", () => {
    expect(
      CreateTodoInput.safeParse({ title: "vet", owner: "someone-else" })
        .success,
    ).toBe(false);
  });
});

describe("UpdateTodoInput", () => {
  test("accepts a partial update and null to clear the due date", () => {
    expect(UpdateTodoInput.parse({ done: true, dueDate: null })).toEqual({
      done: true,
      dueDate: null,
    });
  });

  test("rejects an empty update", () => {
    expect(UpdateTodoInput.safeParse({}).success).toBe(false);
  });

  test("rejects a blank title", () => {
    expect(UpdateTodoInput.safeParse({ title: " " }).success).toBe(false);
  });
});

describe("TodoListFilter", () => {
  test("defaults to all to-dos without a search", () => {
    expect(TodoListFilter.parse({})).toEqual({ status: "all" });
  });

  test("treats a blank search as no search", () => {
    expect(TodoListFilter.parse({ status: "open", search: "  " })).toEqual({
      status: "open",
    });
  });

  test("rejects an unknown status", () => {
    expect(TodoListFilter.safeParse({ status: "later" }).success).toBe(false);
  });
});

describe("response schemas", () => {
  test("Todo accepts what the service returns", () => {
    const todo = {
      id: "0b1c",
      title: "feed the cat",
      dueDate: "2026-10-05",
      done: true,
      createdAt: "2026-10-01T08:00:00.000Z",
      completedAt: "2026-10-02T09:30:00.000Z",
    };

    expect(Todo.parse(todo)).toEqual(todo);
  });

  test("ErrorBody rejects an unknown error code", () => {
    expect(
      ErrorBody.safeParse({ error: { code: "todo-not-found", message: "" } })
        .success,
    ).toBe(true);
    expect(
      ErrorBody.safeParse({ error: { code: "forbidden", message: "" } })
        .success,
    ).toBe(false);
  });
});

describe("describeIssues", () => {
  test("prefixes each issue with its field path", () => {
    const result = CreateTodoInput.safeParse({ title: " ", dueDate: "soon" });
    if (result.success) throw new Error("expected a validation error");

    expect(describeIssues(result.error)).toBe(
      "title: A to-do needs a title. dueDate: Invalid ISO date",
    );
  });

  test("leaves an issue without a path unprefixed", () => {
    const result = UpdateTodoInput.safeParse({});
    if (result.success) throw new Error("expected a validation error");

    expect(describeIssues(result.error)).toBe(
      "Nothing to update: give a title, a due date, or done.",
    );
  });
});
