import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function signUpAndGoHome(page: Page) {
  const email = `lissie-todo-${Date.now()}-${test.info().workerIndex}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Lissie");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return email;
}

test("add a todo", async ({ page }) => {
  await signUpAndGoHome(page);

  await page.getByLabel("To-do title").fill("Buy tuna");
  await page.getByRole("button", { name: "Add" }).click();

  await expect(page.getByRole("checkbox", { name: "Buy tuna" })).toBeVisible();
  await expect(page.getByText("Buy tuna")).toBeVisible();
});

test("add a todo with a due date", async ({ page }) => {
  await signUpAndGoHome(page);

  await page.getByLabel("To-do title").fill("Catch the red dot");
  await page.getByLabel("Due date (optional)").fill("2099-12-31");
  await page.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("Catch the red dot")).toBeVisible();
  await expect(page.getByText("due 2099-12-31")).toBeVisible();
});

test("check off a todo and reopen it", async ({ page }) => {
  await signUpAndGoHome(page);

  await page.getByLabel("To-do title").fill("Nap on keyboard");
  await page.getByRole("button", { name: "Add" }).click();
  const checkbox = page.getByRole("checkbox", { name: "Nap on keyboard" });
  await expect(checkbox).not.toBeChecked();

  await checkbox.click();
  await expect(checkbox).toBeChecked();

  // Reopen it
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
});

test("delete a todo with confirmation", async ({ page }) => {
  await signUpAndGoHome(page);

  await page.getByLabel("To-do title").fill("Knock glass off table");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Knock glass off table")).toBeVisible();

  const todoItem = page
    .getByRole("listitem")
    .filter({ hasText: "Knock glass off table" });

  await todoItem
    .getByRole("button", { name: /Delete "Knock glass off table"/ })
    .click();

  // Confirm deletion
  await todoItem.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("Knock glass off table")).not.toBeVisible();
});

test("cancel a delete request", async ({ page }) => {
  await signUpAndGoHome(page);

  await page.getByLabel("To-do title").fill("Stare at wall");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Stare at wall")).toBeVisible();

  const todoItem = page
    .getByRole("listitem")
    .filter({ hasText: "Stare at wall" });

  await todoItem
    .getByRole("button", { name: /Delete "Stare at wall"/ })
    .click();

  await todoItem.getByRole("button", { name: "Keep" }).click();

  // Todo should still be there
  await expect(page.getByText("Stare at wall")).toBeVisible();
});
