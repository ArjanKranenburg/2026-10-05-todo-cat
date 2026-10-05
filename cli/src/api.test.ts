import { afterEach, expect, test, vi } from "vitest";
import { TodoApi } from "./api";
import { CliError } from "./errors";

// Whatever a server answers outside the contract fails as
// `unexpected-response`, never as a crash or a success.

afterEach(() => {
  vi.unstubAllGlobals();
});

const api = new TodoApi("http://todo-cat.test", "token");

test.each([
  ["an HTML page", new Response("<html>proxy</html>", { status: 200 })],
  ["no body", new Response(null, { status: 204 })],
  ["JSON in another shape", Response.json({ todos: [] })],
])("a success with %s is an unexpected response", async (_, response) => {
  vi.stubGlobal("fetch", async () => response);

  const failure = await api.list({ status: "all" }).catch((error) => error);

  expect(failure).toBeInstanceOf(CliError);
  expect(failure.code).toBe("unexpected-response");
});
