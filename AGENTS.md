<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# todo-cat

A to-do list web app kept by Lissie, a cat with attitude (an AI agent, coming later).
Next.js 16 App Router at the repo root, plus npm workspaces `contract/` (shared zod schemas) and `cli/` (the todo-cat CLI), each with only a placeholder function and its test so far.

## Commands

Run from the repo root.

- `npm install` installs the root app and both workspaces.
- `npm run dev` starts the dev server on http://localhost:3000.
- `npm run build` builds the app for production.
- `npm test` runs Vitest unit and integration tests once.
- `npm run test:e2e` runs Playwright end-to-end tests against its own dev server.
- `npm run lint` runs `biome check` (lint, format and import order); it must pass before every commit.
- `npm run format` rewrites files with the Biome formatter.

## Verify, don't recall

- Next.js, React, Tailwind, TypeScript and Biome here are newer than your training data.
- Check APIs against current docs (`node_modules/next/dist/docs/` for Next.js) before writing code, not against memory.

## Tech docs

`tech-docs/` holds project-specific technical docs; agents are the primary audience.

- Describe approach, principles, design decisions with their reasons, and gotchas.
- Point to the central files instead of copying code.
- Leave out anything an agent finds out by reading the code.
- Current state only: delete outdated content instead of adding caveats.

Index:

- [workspaces.md](tech-docs/workspaces.md) — the npm workspace layout and why it exists before its content does.
- [testing.md](tech-docs/testing.md) — Vitest and Playwright setup, test conventions and the e2e dev server's own output dir.

## Keeping this map current

- When a change invalidates a line here or in `tech-docs/`, or teaches a costly lesson, update them in the same change.
- Prefer deleting over adding, pointers over prose, one sentence per bullet.
