import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { CLI_CLIENT_ID, formatUserCode } from "@todo-cat/contract";

// The browser side of `todo-cat login`: the test plays the CLI with plain
// requests to the device flow endpoints and approves or denies in the page.

const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

async function requestDeviceCode(request: APIRequestContext) {
  const response = await request.post("/api/auth/device/code", {
    data: { client_id: CLI_CLIENT_ID },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { device_code: string; user_code: string };
}

function pollToken(request: APIRequestContext, deviceCode: string) {
  return request.post("/api/auth/device/token", {
    data: {
      grant_type: GRANT_TYPE,
      device_code: deviceCode,
      client_id: CLI_CLIENT_ID,
    },
  });
}

/** Opens the CLI's link signed out and signs up on the way, like a new user would. */
async function openSignedOut(page: Page, userCode: string) {
  const email = `lissie-${Date.now()}-${test.info().workerIndex}@example.com`;
  await page.goto(`/device?user_code=${userCode}`);
  await expect(page).toHaveURL(/\/login\?next=/);

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup\?next=/);
  await page.getByLabel("Name").fill("Lissie");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(`/device?user_code=${userCode}`);
  await expect(
    page.getByRole("heading", { name: "Let todo-cat in?" }),
  ).toBeVisible();
  await expect(
    page.getByText(formatUserCode(userCode), { exact: true }),
  ).toBeVisible();
}

test("approving a code hands the CLI a working session token", async ({
  page,
  request,
}) => {
  const { device_code, user_code } = await requestDeviceCode(request);
  const pending = await pollToken(request, device_code);
  expect((await pending.json()).error).toBe("authorization_pending");

  await openSignedOut(page, user_code);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("status")).toHaveText(/^Approved\./);

  // RFC 8628 polling interval (5 s) before asking again.
  await page.waitForTimeout(5_000);
  const granted = await pollToken(request, device_code);
  expect(granted.ok()).toBe(true);
  const { access_token } = await granted.json();
  const todos = await request.get("/api/todos", {
    headers: { authorization: `Bearer ${access_token}` },
  });
  expect(todos.status()).toBe(200);
});

test("denying a code refuses the CLI", async ({ page, request }) => {
  const { device_code, user_code } = await requestDeviceCode(request);

  await openSignedOut(page, user_code);
  await page.getByRole("button", { name: "Deny" }).click();
  await expect(page.getByRole("status")).toHaveText(/^Denied\./);

  const refused = await pollToken(request, device_code);
  expect((await refused.json()).error).toBe("access_denied");
});

test("an unknown code is rejected with a way to try again", async ({
  page,
}) => {
  const { user_code } = await requestDeviceCode(page.request);
  await openSignedOut(page, user_code);

  await page.goto("/device?user_code=NOPE-NOPE");
  await expect(
    page.getByText(/This code is unknown or has expired/),
  ).toBeVisible();
  await expect(page.getByLabel("Code")).toHaveValue("NOPE-NOPE");
});
