import { afterEach, expect, test, vi } from "vitest";
import { TodoApi } from "./api";
import { CliError } from "./errors";

// Whatever a server answers outside the contract fails as
// `unexpected-response`, never as a crash or a success.

afterEach(() => {
  vi.unstubAllGlobals();
});

const api = new TodoApi("http://todo-cat.test", "token");

const html = () => new Response("<html>proxy</html>", { status: 200 });
const empty = (status: number) => () => new Response(null, { status });
const otherJson = () => Response.json({ todos: [] });

test.each([
  ["list", "an HTML page", () => api.list({ status: "all" }), html],
  ["list", "no body", () => api.list({ status: "all" }), empty(204)],
  [
    "list",
    "JSON in another shape",
    () => api.list({ status: "all" }),
    otherJson,
  ],
  ["delete", "an HTML page", () => api.delete("some-id"), html],
  ["delete", "an empty 200", () => api.delete("some-id"), empty(200)],
  ["delete", "JSON", () => api.delete("some-id"), otherJson],
])(
  "%s answered with %s is an unexpected response",
  async (_, __, call, answer) => {
    vi.stubGlobal("fetch", async () => answer());

    const failure = await call().catch((error) => error);

    expect(failure).toBeInstanceOf(CliError);
    expect(failure.code).toBe("unexpected-response");
  },
);

test("delete answered with 204 succeeds", async () => {
  vi.stubGlobal("fetch", async () => empty(204)());

  await expect(api.delete("some-id")).resolves.toBeUndefined();
});
