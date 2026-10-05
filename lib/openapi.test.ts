import { readFileSync } from "node:fs";
import { CreateTodoInput, UpdateTodoInput } from "@todo-cat/contract";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { createOpenApiDocument } from "./openapi";

const document = createOpenApiDocument();

test("the committed openapi.json matches the schemas", () => {
  const committed = JSON.parse(readFileSync("openapi.json", "utf8"));

  // On failure: npm run openapi:generate
  expect(committed).toEqual(document);
});

/** A component schema of the document, as a validator. */
const documented = (name: string) =>
  z.fromJSONSchema(
    document.components?.schemas?.[name] as z.core.JSONSchema.JSONSchema,
  );

// The document cannot express the server's normalization, so it may accept
// input the server rejects, never the other way round: a client that checks
// input against the document must not refuse what the server takes.
describe.each<{
  name: string;
  server: z.ZodType;
  accepted: object[];
  rejected: object[];
}>([
  {
    name: "CreateTodoInput",
    server: CreateTodoInput,
    accepted: [
      { title: "feed the cat" },
      { title: `${" ".repeat(200)}x` },
      { title: "a".repeat(200), dueDate: "2026-02-28" },
      { title: "vet", dueDate: null },
    ],
    rejected: [{}, { title: "" }, { title: "vet", priority: 1 }],
  },
  {
    name: "UpdateTodoInput",
    server: UpdateTodoInput,
    accepted: [
      { title: `  ${"a".repeat(200)}  ` },
      { dueDate: null },
      { done: true },
    ],
    rejected: [{}, { title: "" }, { done: true, priority: 1 }],
  },
])("the documented $name", ({ name, server, accepted, rejected }) => {
  test.each(accepted)("accepts what the server accepts: %j", (input) => {
    expect(server.safeParse(input).success).toBe(true);
    expect(documented(name).safeParse(input).success).toBe(true);
  });

  test.each(rejected)("rejects what JSON Schema can express: %j", (input) => {
    expect(server.safeParse(input).success).toBe(false);
    expect(documented(name).safeParse(input).success).toBe(false);
  });
});
