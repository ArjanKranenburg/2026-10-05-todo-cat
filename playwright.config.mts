import { createServer } from "node:net";
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
// workers inherit the env var, so all of them agree on the first pick.
process.env.E2E_PORT ??= String(await findFreePort());
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${process.env.E2E_PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    // A separate output dir sidesteps the `next dev` lock on `.next/dev`,
    // so e2e runs next to `npm run dev`.
    env: { NEXT_DIST_DIR: ".next-e2e" },
  },
});
