import "server-only";
import type { ErrorBody, ErrorCode } from "@todo-cat/contract";
import type { z } from "zod";
import { getUserId } from "./session";
import { TodoError } from "./todo-service";

// Shared plumbing of the REST adapter (app/api/todos, tech-docs/rest-api.md):
// authenticate, parse input with the contract schemas, map errors to
// `{ error: { code, message } }` with the status code that belongs to the code.

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  "todo-not-found": 404,
  "validation-failed": 400,
};

/** Input that fails its contract schema; answered with 400 `validation-failed`. */
class InvalidInput extends Error {}

function errorResponse(
  code: ErrorCode,
  message: string,
  headers?: HeadersInit,
) {
  const body: ErrorBody = { error: { code, message } };
  return Response.json(body, { status: STATUS[code], headers });
}

/**
 * Runs one REST use case for the signed-in user (bearer token or session
 * cookie). Answers 401 before looking at the input, and maps `TodoError` and
 * invalid input to error bodies; anything else is a bug and propagates.
 */
export async function handle(
  request: Request,
  run: (userId: string) => Promise<Response>,
): Promise<Response> {
  const userId = await getUserId(request.headers);
  if (!userId) {
    return errorResponse(
      "unauthorized",
      "Sign in first: send `Authorization: Bearer <session token>`.",
      { "www-authenticate": "Bearer" },
    );
  }
  try {
    return await run(userId);
  } catch (error) {
    if (error instanceof TodoError) {
      return errorResponse(error.code, error.message);
    }
    if (error instanceof InvalidInput) {
      return errorResponse("validation-failed", error.message);
    }
    throw error;
  }
}

/** Parses `data` with a contract schema; one sentence per issue, prefixed by its path. */
function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const messages = result.error.issues.map((issue) =>
    issue.path.length > 0
      ? `${issue.path.join(".")}: ${issue.message}`
      : issue.message,
  );
  throw new InvalidInput(messages.join(" "));
}

/** The query string as a plain object; a repeated parameter keeps its last value. */
export function parseQuery<S extends z.ZodType>(
  schema: S,
  request: Request,
): z.output<S> {
  return parse(schema, Object.fromEntries(new URL(request.url).searchParams));
}

export async function parseBody<S extends z.ZodType>(
  schema: S,
  request: Request,
): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InvalidInput("The request body is not valid JSON.");
  }
  return parse(schema, body);
}
