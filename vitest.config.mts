import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**", ".next/**", ".next-e2e/**"],
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
