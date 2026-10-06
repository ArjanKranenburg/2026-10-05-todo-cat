import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

// Playwright evaluates this file in the runner and again in every worker;
// workers inherit the env vars, so all of them agree on the first pick.
process.env.E2E_PORT ??= String(await findFreePort());
process.env.E2E_DIST_DIR ??= ".next-e2e";
process.env.E2E_DATABASE_URL ??= `file:${join(tmpdir(), `todo-cat-e2e-${process.pid}-${Date.now()}.db`)}`;
const baseURL = `http://localhost:${process.env.E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      // Specs that call Lissie's real model run only in the "model" project.
      testIgnore: "**/*.model.spec.ts",
    },
    {
      // `npm run test:e2e:model`: needs OPENROUTER_API_KEY, stays out of QA and CI.
      name: "model",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/*.model.spec.ts",
      timeout: 180_000,
    },
  ],
  webServer: {
    // Migrates the fresh e2e database first; DATABASE_URL comes from `env` below.
    command: `npm run --silent db:migrate && npx next dev --port ${process.env.E2E_PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    // Own output dir and database, so e2e runs next to `npm run dev`
    // and next to e2e runs of other checkouts.
    env: {
      NEXT_DIST_DIR: process.env.E2E_DIST_DIR,
      DATABASE_URL: process.env.E2E_DATABASE_URL,
      // Better Auth checks request origins against its base URL.
      BETTER_AUTH_URL: baseURL,
    },
  },
});
