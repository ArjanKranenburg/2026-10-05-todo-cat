import { expect, test } from "@playwright/test";

test("sign up, sign out and sign in again", async ({ page }) => {
  // Unique per run, so retries and parallel workers never collide.
  const email = `lissie-${Date.now()}-${test.info().workerIndex}@example.com`;
  const password = "tuna-o-clock";

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByLabel("Name").fill("Lissie");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Hi, Lissie" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-tuna");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  // The failed attempt resets the form: the email stays, the password is cleared.
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Password")).toHaveValue("");

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Hi, Lissie" })).toBeVisible();
});
