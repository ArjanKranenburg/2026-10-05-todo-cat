import { createClient } from "@libsql/client";
import type { StorageDomains } from "@mastra/core/storage";
import { expect, type Page, test } from "@playwright/test";
import { mastraStorage } from "../lib/mastra-storage";

// The chat on / without calling the model; e2e/lissie.model.spec.ts talks to it.

async function signUp(page: Page): Promise<string> {
  const email = `chat-${Date.now()}-${test.info().workerIndex}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Rainer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return email;
}

/**
 * Runs `write` on Lissie's memory store in the e2e database, for the one
 * thread the user's first visit to / started.
 */
async function withMemory(
  email: string,
  write: (thread: {
    memory: NonNullable<StorageDomains["memory"]>;
    resourceId: string;
    threadId: string;
  }) => Promise<void>,
) {
  // The e2e server writes to the same file; wait for its locks (lib/db.ts).
  const client = createClient({
    url: process.env.E2E_DATABASE_URL ?? "",
    timeout: 5_000,
  });
  try {
    const { rows } = await client.execute({
      sql: "select id from user where email = ?",
      args: [email],
    });
    const resourceId = String(rows[0]?.id);
    const memory = await mastraStorage(client, {
      disableInit: true,
    }).getStore("memory");
    if (!memory) throw new Error("Mastra has no memory store");
    const { threads } = await memory.listThreads({ filter: { resourceId } });
    expect(threads).toHaveLength(1);
    await write({ memory, resourceId, threadId: threads[0].id });
  } finally {
    client.close();
  }
}

/** Writes a conversation long enough to overflow the viewport. */
async function seedLongConversation(email: string) {
  await withMemory(email, async ({ memory, resourceId, threadId }) => {
    const start = Date.now();
    await memory.saveMessages({
      messages: Array.from({ length: 30 }, (_, i) => {
        const text = `Message ${i}: about item ${i} on my list.`;
        return {
          id: `${threadId}-seed-${i}`,
          threadId,
          resourceId,
          role: i % 2 ? ("assistant" as const) : ("user" as const),
          createdAt: new Date(start + i * 1000),
          content: { format: 2 as const, parts: [{ type: "text", text }] },
        };
      }),
    });
  });
}

/**
 * Writes one of Lissie's turns with three tool calls (one failed) into the
 * thread the user's first visit to / started, as Mastra stores it.
 */
async function seedToolCalls(email: string) {
  await withMemory(email, async ({ memory, resourceId, threadId }) => {
    const todo = {
      id: "todo-1",
      title: "buy milk",
      dueDate: null,
      done: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    const call = (
      toolCallId: string,
      toolName: string,
      args: unknown,
      result: unknown,
    ) => ({
      type: "tool-invocation" as const,
      toolInvocation: {
        state: "result" as const,
        toolCallId,
        toolName,
        args,
        result,
      },
    });
    const start = Date.now();
    await memory.saveMessages({
      messages: [
        {
          id: `${threadId}-ask`,
          threadId,
          resourceId,
          role: "user",
          createdAt: new Date(start),
          content: {
            format: 2,
            parts: [{ type: "text", text: "Add milk, and finish nope." }],
          },
        },
        {
          id: `${threadId}-answer`,
          threadId,
          resourceId,
          role: "assistant",
          createdAt: new Date(start + 1000),
          content: {
            format: 2,
            parts: [
              call(
                "call-1",
                "listTodos",
                {},
                {
                  todos: [{ ...todo, id: "todo-0", done: true }],
                },
              ),
              { type: "step-start" },
              call("call-2", "addTodo", { title: "buy milk" }, todo),
              call(
                "call-3",
                "setTodoDone",
                { id: "nope", done: true },
                {
                  error: {
                    code: "todo-not-found",
                    message: "There is no to-do with id nope.",
                  },
                },
              ),
              { type: "step-start" },
              { type: "text", text: "Milk. Noted." },
            ],
          },
        },
      ],
    });
  });
}

test("the home page shows the chat and connects to the user's thread", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const connected = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/copilotkit/agent/lissie/connect") &&
      response.status() === 200,
  );

  await signUp(page);

  await connected;
  await expect(page.getByRole("heading", { name: "Hi, Rainer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(
    page.getByPlaceholder("Tell Lissie what needs doing…"),
  ).toBeVisible();
  await expect(page.getByTestId("copilot-user-message")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the conversation scrolls between a fixed header and input, not the page", async ({
  page,
}) => {
  await seedLongConversation(await signUp(page));
  await page.reload();
  const conversation = page.getByTestId("copilot-message-list");
  await expect(conversation.getByText("Message 29:")).toBeVisible();

  const scrolls = await page.evaluate(() => {
    const root = document.scrollingElement;
    if (!root) throw new Error("no scrolling element");
    return root.scrollHeight > root.clientHeight;
  });
  expect(scrolls).toBe(false);
  await expect(
    page.getByRole("heading", { name: "Hi, Rainer" }),
  ).toBeInViewport();
  await expect(
    page.getByPlaceholder("Tell Lissie what needs doing…"),
  ).toBeInViewport();
  await expect(conversation.getByText("Message 0:")).not.toBeInViewport();
});

test("New conversation starts an empty chat that stays current after a reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const connected = () =>
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/copilotkit/agent/lissie/connect") &&
        response.status() === 200,
    );
  await seedLongConversation(await signUp(page));
  await page.reload();
  await expect(page.getByText("Message 29:")).toBeVisible();

  const reconnected = connected();
  await page.getByRole("button", { name: "New conversation" }).click();
  await reconnected;

  await expect(page.getByText("Message 29:")).toHaveCount(0);
  const replayed = connected();
  await page.reload();
  await replayed;
  await expect(
    page.getByPlaceholder("Tell Lissie what needs doing…"),
  ).toBeVisible();
  await expect(page.getByText("Message 29:")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the todo panel shows the user's open and done to-dos", async ({
  page,
}) => {
  await signUp(page);
  const sidebar = page.getByRole("complementary", { name: "Your to-dos" });
  await expect(sidebar.getByText("Nothing open. Suspicious.")).toBeVisible();

  // Seed two todos via the REST API; the panel reloads them on page refresh.
  for (const title of ["buy milk", "feed the cat"]) {
    const added = await page.request.post("/api/todos", { data: { title } });
    expect(added.status()).toBe(201);
    if (title === "feed the cat") {
      const { id } = await added.json();
      await page.request.patch(`/api/todos/${id}`, { data: { done: true } });
    }
  }
  await page.reload();

  const open = sidebar.getByRole("region", { name: /Open/ });
  const done = sidebar.getByRole("region", { name: /Done/ });
  await expect(open.getByRole("listitem")).toHaveText(["buy milk"]);
  await expect(done.getByRole("listitem")).toHaveText(["feed the cat"]);
  // The panel is interactive: each todo has a cat-eye checkbox.
  await expect(sidebar.getByRole("checkbox")).toHaveCount(2);
});

test("Lissie's tool calls replay as one readable line each", async ({
  page,
}) => {
  const email = await signUp(page);
  await seedToolCalls(email);
  await page.reload();

  const conversation = page.getByTestId("copilot-message-list");
  await expect(conversation.getByTestId("lissie-tool-call")).toHaveText([
    "✓Looked through your list: 0 open, 1 done",
    "✓Added “buy milk”",
    "✕Could not change that to-do: There is no to-do with id nope.",
  ]);
  await expect(conversation.getByText("Milk. Noted.")).toBeVisible();
  // No raw tool arguments or results anywhere in the chat.
  await expect(conversation.getByText("toolCallId")).toHaveCount(0);
  await expect(conversation.getByText('"title"')).toHaveCount(0);
});

test("the chat runtime turns away requests without a session", async ({
  request,
}) => {
  const response = await request.get("/api/copilotkit/info");

  expect(response.status()).toBe(401);
});
