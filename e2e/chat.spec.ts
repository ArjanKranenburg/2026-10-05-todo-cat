import { createClient } from "@libsql/client";
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
 * Writes a conversation long enough to overflow the viewport into the thread
 * the user's first visit to / started in Lissie's memory.
 */
async function seedLongConversation(email: string) {
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
    const threadId = threads[0].id;
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
  } finally {
    client.close();
  }
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

test("the chat runtime turns away requests without a session", async ({
  request,
}) => {
  const response = await request.get("/api/copilotkit/info");

  expect(response.status()).toBe(401);
});
