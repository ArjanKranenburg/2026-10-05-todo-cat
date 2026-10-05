import {
  CreateTodoInput,
  ErrorBody,
  type ErrorCode,
  Todo,
  TodoList,
  TodoListFilter,
  UpdateTodoInput,
} from "@todo-cat/contract";
import { z } from "zod";
import { createDocument, type ZodOpenApiResponsesObject } from "zod-openapi";
import packageJson from "../package.json" with { type: "json" };

// The OpenAPI document of the REST adapter (tech-docs/rest-api.md), derived
// from the contract schemas the route handlers parse with. It is served at
// /api/openapi.json and committed as openapi.json (`npm run openapi:generate`)
// for clients outside this repository; the CLI uses the contract directly.

const json = (schema: z.ZodType) => ({
  content: { "application/json": { schema } },
});

/** An error response; `codes` lists the `ErrorBody` codes it can carry. */
const error = (...codes: ErrorCode[]) => ({
  description: `Error ${codes.map((code) => `\`${code}\``).join(" or ")}.`,
  ...json(ErrorBody),
});

const unauthorized = {
  "401": {
    ...error("unauthorized"),
    headers: z.object({ "www-authenticate": z.literal("Bearer") }),
  },
} satisfies ZodOpenApiResponsesObject;

const todoId = {
  path: z.object({ id: z.string().meta({ description: "The to-do's id." }) }),
};

export function createOpenApiDocument() {
  return createDocument(
    {
      openapi: "3.1.0",
      info: {
        title: "todo-cat",
        version: packageJson.version,
        description:
          "The to-do list kept by Lissie the cat. Every to-do belongs to the signed-in user; another user's to-do is not found. Clients switch on the error code, never the message.",
      },
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description:
              "A Better Auth session token: from the `set-auth-token` header of a sign-in, or from `todo-cat login`.",
          },
        },
      },
      paths: {
        "/api/todos": {
          get: {
            operationId: "listTodos",
            summary:
              "List to-dos: open ones first, then by due date, then oldest first.",
            requestParams: { query: TodoListFilter },
            responses: {
              "200": { description: "The to-dos.", ...json(TodoList) },
              "400": error("validation-failed"),
              ...unauthorized,
            },
          },
          post: {
            operationId: "addTodo",
            summary: "Add a to-do.",
            requestBody: { required: true, ...json(CreateTodoInput) },
            responses: {
              "201": {
                description: "The new to-do.",
                ...json(Todo),
                headers: z.object({
                  location: z.string().meta({ description: "/api/todos/<id>" }),
                }),
              },
              "400": error("validation-failed"),
              ...unauthorized,
            },
          },
        },
        "/api/todos/{id}": {
          get: {
            operationId: "getTodo",
            summary: "Get one to-do.",
            requestParams: todoId,
            responses: {
              "200": { description: "The to-do.", ...json(Todo) },
              ...unauthorized,
              "404": error("todo-not-found"),
            },
          },
          patch: {
            operationId: "updateTodo",
            summary:
              "Change a to-do's title, due date (null clears it) or done state.",
            requestParams: todoId,
            requestBody: { required: true, ...json(UpdateTodoInput) },
            responses: {
              "200": { description: "The updated to-do.", ...json(Todo) },
              "400": error("validation-failed"),
              ...unauthorized,
              "404": error("todo-not-found"),
            },
          },
          delete: {
            operationId: "deleteTodo",
            summary: "Delete a to-do for good.",
            requestParams: todoId,
            responses: {
              "204": { description: "Deleted; no body." },
              ...unauthorized,
              "404": error("todo-not-found"),
            },
          },
        },
      },
    },
    {
      // zod renders ISO dates and timestamps as `format` plus its own long
      // regex; the format says it all, and generators turn the regex into
      // unreadable validation messages.
      override: ({ jsonSchema }) => {
        if (jsonSchema.format === "date" || jsonSchema.format === "date-time") {
          delete jsonSchema.pattern;
        }
      },
    },
  );
}
