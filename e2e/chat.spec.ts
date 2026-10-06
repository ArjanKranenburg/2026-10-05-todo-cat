import { expect, type Page, test } from "@playwright/test";

// The chat on / without calling the model; e2e/lissie.model.spec.ts talks to it.

async function signUp(page: Page) {
  const email = `chat-${Date.now()}-${test.info().workerIndex}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Rainer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
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

test("the chat runtime turns away requests without a session", async ({
  request,
}) => {
  const response = await request.get("/api/copilotkit/info");

  expect(response.status()).toBe(401);
});
