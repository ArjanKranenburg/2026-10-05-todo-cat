import { expect, type Page, test } from "@playwright/test";

// Talks to Lissie's real model through OpenRouter (OPENROUTER_API_KEY in
// .env), so it runs only with `npm run test:e2e:model`, never in QA or CI.

async function signUp(page: Page, name: string) {
  const email = `${name.toLowerCase()}-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("Lissie answers, remembers the conversation, and keeps it to its owner", async ({
  page,
}) => {
  await signUp(page, "Rainer");
  const question = "I need to buy cat food tomorrow. Can you help me plan?";
  const ran = page.waitForResponse((response) =>
    response.url().endsWith("/api/copilotkit/agent/lissie/run"),
  );
  await page.getByPlaceholder("Tell Lissie what needs doing…").fill(question);
  await page.getByTestId("copilot-send-button").click();

  await expect(page.getByTestId("copilot-user-message")).toHaveText(question);
  // The run's event stream has ended, and the chat shows the finished reply.
  await (await ran).finished();
  const answer = page.getByTestId("copilot-assistant-message").last();
  await expect(answer.getByTestId("copilot-assistant-toolbar")).toBeVisible();
  const reply = await answer.innerText();
  expect(reply.trim()).not.toBe("");

  await page.reload();
  await expect(page.getByTestId("copilot-user-message")).toHaveText(question);
  // innerText on both sides: toHaveText reads textContent, which drops the
  // break between paragraphs of a multi-paragraph reply.
  const replayed = page.getByTestId("copilot-assistant-message").last();
  await expect.poll(() => replayed.innerText()).toBe(reply);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signUp(page, "Stranger");
  await expect(
    page.getByPlaceholder("Tell Lissie what needs doing…"),
  ).toBeVisible();
  await expect(page.getByText(question)).toHaveCount(0);
});

test("Lissie adds a to-do with her tool, and the sidebar shows it at once", async ({
  page,
}) => {
  await signUp(page, "Milkman");
  const sidebar = page.getByRole("complementary", { name: "Your to-dos" });
  const open = sidebar.getByRole("region", { name: /Open/ });
  await expect(open.getByRole("listitem")).toHaveCount(0);

  const ran = page.waitForResponse((response) =>
    response.url().endsWith("/api/copilotkit/agent/lissie/run"),
  );
  await page
    .getByPlaceholder("Tell Lissie what needs doing…")
    .fill('Please add "buy milk" to my list.');
  await page.getByTestId("copilot-send-button").click();
  await (await ran).finished();

  // No reload: the finished tool call refreshed the sidebar.
  await expect(open.getByRole("listitem")).toHaveText(["buy milk"]);
  const line = page
    .getByTestId("lissie-tool-call")
    .filter({ hasText: "Added “buy milk”" });
  await expect(line).toHaveCount(1);
  // She comments on what she added.
  const answer = page.getByTestId("copilot-assistant-message").last();
  await expect(answer.getByTestId("copilot-assistant-toolbar")).toBeVisible();
  expect((await answer.innerText()).trim()).not.toBe("");

  await page.reload();
  await expect(line).toHaveCount(1);
  await expect(open.getByRole("listitem")).toHaveText(["buy milk"]);
});
