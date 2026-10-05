import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // server-only throws unless imported under the react-server condition, which
    // Next.js sets for server code; tests import server modules directly.
    alias: {
      "server-only": fileURLToPath(
        new URL("node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**", ".next/**", ".next-e2e*/**"],
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        extends: true,
        test: { name: "dom", environment: "jsdom", include: ["**/*.test.tsx"] },
      },
      {
        extends: true,
        test: { name: "node", environment: "node", include: ["**/*.test.ts"] },
      },
    ],
  },
});
