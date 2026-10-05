# Workspaces

## Layout

- The repo root is the Next.js web app and also the npm workspace root (`workspaces` in `package.json`).
- `contract/` (package `@todo-cat/contract`) will hold the zod schemas shared by the web app and the CLI.
- `cli/` (package `todo-cat-cli`) will hold the todo-cat command-line client.

## Why the workspaces exist before their content

- The web app and the CLI must agree on the shape of to-dos and API payloads, so that agreement gets one home (`contract/`) instead of being duplicated and drifting.
- Fixing the package boundaries up front means the first schema or CLI command lands in the right place instead of inside `app/` and being moved later.
- One root `package-lock.json` and one `npm install` cover all packages, and npm links `@todo-cat/contract` into `node_modules` so the app and CLI import it by name.

## Gotchas

- Add a dependency to a workspace with `npm install <pkg> -w contract` (or `-w cli`); without `-w` it lands in the root app's `package.json`.
