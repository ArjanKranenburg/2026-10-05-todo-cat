import {
  type CreateTodoInput,
  describeIssues,
  ErrorBody,
  Todo,
  TodoList,
  type TodoListFilter,
  type UpdateTodoInput,
} from "@todo-cat/contract";
import type { z } from "zod";
import { CliError, unreachable } from "./errors";

// The REST client (tech-docs/rest-api.md). Inputs are parsed with the contract
// schemas before they are sent, responses after they arrive, so a server
// change that breaks the shape fails loudly here.

/** How long one request may take before the CLI gives up. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Parses user input with a contract schema; fails like the API would, without a request. */
export function validate<S extends z.ZodType>(
  schema: S,
  data: unknown,
): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new CliError("validation-failed", describeIssues(result.error));
  }
  return result.data;
}

export class TodoApi {
  constructor(
    readonly server: string,
    private readonly token: string,
  ) {}

  list(filter: TodoListFilter): Promise<TodoList> {
    const query = new URLSearchParams({ status: filter.status });
    if (filter.search) query.set("search", filter.search);
    return this.request("GET", `/api/todos?${query}`, TodoList);
  }

  get(id: string): Promise<Todo> {
    return this.request("GET", todoPath(id), Todo);
  }

  add(input: CreateTodoInput): Promise<Todo> {
    return this.request("POST", "/api/todos", Todo, input);
  }

  update(id: string, patch: UpdateTodoInput): Promise<Todo> {
    return this.request("PATCH", todoPath(id), Todo, patch);
  }

  async delete(id: string): Promise<void> {
    await this.send("DELETE", todoPath(id));
  }

  private async request<S extends z.ZodType>(
    method: string,
    path: string,
    schema: S,
    body?: unknown,
  ): Promise<z.output<S>> {
    const result = schema.safeParse(await this.send(method, path, body));
    if (!result.success) {
      throw new CliError(
        "unexpected-response",
        `${method} ${path} answered in an unexpected shape: ${describeIssues(result.error)}`,
      );
    }
    return result.data;
  }

  /** Sends one request and returns its JSON body; maps error responses to CliError. */
  private async send(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const headers = new Headers({
      accept: "application/json",
      authorization: `Bearer ${this.token}`,
    });
    if (body !== undefined) headers.set("content-type", "application/json");
    let response: Response;
    try {
      response = await fetch(`${this.server}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw unreachable(this.server, error);
    }
    const data: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw this.errorFor(response, data);
    return data;
  }

  private errorFor(response: Response, data: unknown): CliError {
    const body = ErrorBody.safeParse(data);
    if (!body.success) {
      return new CliError(
        "unexpected-response",
        `The server answered ${response.status} ${response.statusText} without an error body.`,
      );
    }
    const { code, message } = body.data.error;
    if (code === "unauthorized") {
      return new CliError(
        "unauthorized",
        `The session for ${this.server} has expired or was revoked. Run \`todo-cat login\` again.`,
      );
    }
    return new CliError(code, message);
  }
}

function todoPath(id: string): string {
  return `/api/todos/${encodeURIComponent(id)}`;
}
