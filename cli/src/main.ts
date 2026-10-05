#!/usr/bin/env node
import { run } from "./program";

// The `todo-cat` bin (built to dist/todo-cat.mjs); see tech-docs/cli.md.
process.exitCode = await run(process.argv.slice(2), {
  env: process.env,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
