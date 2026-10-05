<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# todo-cat

A to-do list web app kept by Lissie, a cat with attitude (an AI agent, coming later).
Next.js 16 App Router at the repo root, plus npm workspaces `contract/` (shared zod schemas) and `cli/` (the `todo-cat` CLI, a REST client for agents and humans).
Persistence is Drizzle ORM on SQLite via `lib/db.ts`; authentication is Better Auth (email and password).
The todo core exists (the `todos` table, `lib/todo-service.ts`, the zod schemas in `contract/`), and so do its REST adapter (`/api/todos`) and the CLI on top of it (login via the device flow and the `/device` approval page); agent tools and MCP do not yet.

## Commands

Run from the repo root.

- `npm install` installs the root app and both workspaces.
- `npm run dev` starts the dev server on http://localhost:3000.
- `npm run build` builds the app for production.
- `npx todo-cat --help` runs the CLI against `TODO_CAT_URL` (default http://localhost:3000); `npm run build -w todo-cat-cli` rebuilds it after changes in `cli/src/`.
- `npm test` runs Vitest unit and integration tests once.
- `npm run test:e2e` runs Playwright end-to-end tests against its own dev server.
- `npm run lint` runs `biome check` (lint, format and import order); it must pass before every commit.
- `npm run typecheck` type-checks the app and both workspaces.
- `npm run qa` runs every gate (Biome, typecheck, app and CLI builds, Vitest, Playwright) and prints only what failed; CI runs the same script.
- `npm run format` rewrites files with the Biome formatter.
- `npm run db:generate` writes a migration to `drizzle/` from changes in `lib/schema.ts`.
- `npm run db:auth-schema` regenerates `lib/auth-schema.ts` from the Better Auth config; follow it with `db:generate`.
- `npm run db:migrate` applies pending migrations to the database at `DATABASE_URL`.
- `npm run db:reset` deletes the local database file and migrates a fresh one.
- `npm run db:seed` (re)creates the demo user `demo@todo-cat.dev` (password `cat-person-2026`) with a dozen to-dos.

## Definition of done

- Run `npm run qa` before you call a task done; it must end with `QA: PASS`.
- Fix the code instead of suppressing findings: no `biome-ignore`, `@ts-expect-error`, `@ts-ignore`, skipped tests or loosened config to get green.

## Verify, don't recall

- Next.js, React, Tailwind, TypeScript and Biome here are newer than your training data.
- Check APIs against current docs before writing code, not against memory; see Researching docs for where.

## Researching docs

- Next.js: the version-matched guides in `node_modules/next/dist/docs/`.
- Drizzle: start at https://orm.drizzle.team/llms.txt and follow its `docs/sqlite/...` links; the docs target the v1 RC installed here, and the pages are HTML, so fetch them and read the text.
- Other vendors that publish an `llms.txt` (try `https://<docs-site>/llms.txt`): start there before searching.
- Libraries with an installed skill in `.claude/skills/` (Mastra, CopilotKit; `impeccable` and `frontend-design` for UI design): load the skill, which points at current docs.
- Any other library (React, Tailwind, Biome, Vitest, Playwright, zod, libsql, ...): the `ctx7` CLI from the `find-docs` skill (`npx ctx7@latest library <name> "<question>"`, then `docs <id> "<question>"`).
- When docs and code disagree, the type declarations in `node_modules/<pkg>` are the truth for the installed version.

## Tech docs

`tech-docs/` holds project-specific technical docs; agents are the primary audience.

- Describe approach, principles, design decisions with their reasons, and gotchas.
- Point to the central files instead of copying code.
- Leave out anything an agent finds out by reading the code.
- Current state only: delete outdated content instead of adding caveats.

Index:

- [architecture.md](tech-docs/architecture.md) — the todo service and its thin adapters: ownership rules, data, the contract, error codes.
- [workspaces.md](tech-docs/workspaces.md) — the npm workspace layout and why it exists before its content does.
- [testing.md](tech-docs/testing.md) — Vitest and Playwright setup, test conventions, the e2e server's isolation, the QA script and CI.
- [database.md](tech-docs/database.md) — Drizzle on SQLite: the single `lib/db.ts` connection, the migration workflow, test databases and v1 gotchas.
- [rest-api.md](tech-docs/rest-api.md) — the `/api/todos` endpoints, their schemas and status codes, and how to get a bearer token with curl.
- [auth.md](tech-docs/auth.md) — Better Auth: config layout, the `getUserId` helper every adapter uses, server-action forms, schema generation and test setup.
- [cli.md](tech-docs/cli.md) — the `todo-cat` CLI: commands, agent-friendly output and exit codes, device-flow login, credentials, the build and its end-to-end test.

## Keeping this map current

- When a change invalidates a line here or in `tech-docs/`, or teaches a costly lesson, update them in the same change.
- Prefer deleting over adding, pointers over prose, one sentence per bullet.
