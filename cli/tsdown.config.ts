import { defineConfig } from "tsdown";

// Bundles the CLI into dist/todo-cat.mjs, the `todo-cat` bin. The contract is a
// devDependency because it ships TypeScript source and gets bundled; runtime
// dependencies stay external and resolve from node_modules.
export default defineConfig({
  entry: { "todo-cat": "src/main.ts" },
  platform: "node",
  format: "esm",
  outDir: "dist",
});
