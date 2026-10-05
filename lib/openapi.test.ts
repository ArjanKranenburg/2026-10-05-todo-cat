import { readFileSync } from "node:fs";
import { CreateTodoInput, UpdateTodoInput } from "@todo-cat/contract";
import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { createOpenApiDocument } from "./openapi";

const document = createOpenApiDocument();

test("the committed openapi.json matches the schemas", () => {
  const committed = JSON.parse(readFileSync("openapi.json", "utf8"));

  // On failure: npm run openapi:generate
  expect(committed).toEqual(document);
});

// OpenAPI 3.1 schemas are JSON Schema 2020-12; formats such as `date` are
// checked like a strict client would.
const ajv = addFormats(new Ajv2020());

/** Whether a component schema of the document accepts the input. */
const documentedAccepts = (name: string, input: object) =>
  ajv.validate(document.components?.schemas?.[name] ?? false, input);

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
    rejected: [
      {},
      { title: "" },
      { title: "vet", dueDate: "2026-02-30" },
      { title: "vet", priority: 1 },
    ],
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
    expect(documentedAccepts(name, input)).toBe(true);
  });

  test.each(rejected)("rejects what JSON Schema can express: %j", (input) => {
    expect(server.safeParse(input).success).toBe(false);
    expect(documentedAccepts(name, input)).toBe(false);
  });
});
