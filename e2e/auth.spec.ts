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

test("Continue with Google goes to Google's consent screen", async ({
  page,
  baseURL,
}) => {
  // Google itself is out of reach; stop at its door and check what we sent.
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Google consent stub" }),
  );

  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with Google" }).click();

  await expect(page.getByText("Google consent stub")).toBeVisible();
  const url = new URL(page.url());
  expect(url.origin + url.pathname).toBe(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  expect(url.searchParams.get("client_id")).toBe("e2e-google-client-id");
  expect(url.searchParams.get("redirect_uri")).toBe(
    `${baseURL}/api/auth/callback/google`,
  );
});

test("a failed Google sign-in explains itself on the sign-in page", async ({
  page,
}) => {
  await page.goto("/login?error=account_not_linked");

  await expect(
    page.getByText(
      "That email already has an account. Sign in with your password.",
    ),
  ).toBeVisible();
});
