# Testing

## Strategy

- Vitest covers unit and integration tests: pure logic, zod schemas, synchronous components, route handlers and CLI code.
- Playwright covers end-to-end flows in a real browser against a real `next dev` server, Chromium only.
- `async` Server Components cannot be rendered by Vitest (Next.js testing guide), so test them end to end.
- Each tool has one smoke test (`components/ui/text-field.test.tsx`, `e2e/smoke.spec.ts`) that proves the harness itself works.

## Commands

- `npm test` runs Vitest once; `npm run test:watch` keeps it watching.
- `npm run test:e2e` runs Playwright, which starts and stops its own dev server.
- `npx playwright install chromium` fetches the browser on a fresh machine.
- `npm run typecheck` runs `next typegen` and then `tsc --noEmit`; the root `tsconfig.json` globs cover both workspaces, so they need no tsconfig of their own yet.
- `npm run qa` (`scripts/qa.sh`) runs Biome, typecheck, production build, Vitest and Playwright in that order.

## QA script

- It runs every section even after a failure, so one run reports all problems.
- Each section prints one `PASS`/`FAIL` line; only failing sections print their output, and every section's full output lands in `qa.log` (`QA_LOG` overrides the path).
- Output is plain text for agents: `NO_COLOR=1`, Biome `--colors=off`, `tsc --pretty false` (one `file(line,col): error` line per finding).
- Keep each section a call to an npm script so `qa.sh` and `package.json` cannot drift apart.

## CI

- `.github/workflows/ci.yml` runs `npm run qa` on every push and pull request with Node 24 and `npm ci`; it never deploys.
- It writes `.env` from `.env.example`, replacing every value whose key contains `SECRET`, `KEY`, `TOKEN` or `PASSWORD` with a random dummy, so a new secret in `.env.example` needs no workflow change and real secrets never reach CI.
- Playwright browsers are cached per Playwright version; on a cache hit only the system dependencies are installed.
- On failure the run uploads `qa.log` and `test-results/` as the `qa-results` artifact.
- Watch a run with `gh run watch`; read a failed one with `gh run view --log-failed`.

## Conventions

- Vitest tests are colocated as `*.test.ts` / `*.test.tsx` anywhere in the repo, workspaces included; Playwright specs live in `e2e/` as `*.spec.ts`.
- The file extension picks the Vitest environment (`projects` in `vitest.config.mts`): `.test.tsx` runs in jsdom, `.test.ts` runs in Node.
- Import `test`/`expect` from `vitest` explicitly; Vitest globals are off.
- Workspaces have no Vitest config or `test` script of their own; the root `npm test` runs every workspace's tests.

## Design decisions

- The e2e dev server writes to `.next-e2e/` instead of `.next/` (`NEXT_DIST_DIR` in `next.config.ts`), because Next 16 locks `.next/dev` and a second `next dev` in the same directory exits even on another port.
- `playwright.config.mts` picks a free port on every run, so e2e never collides with `npm run dev` or other local servers; it is `.mts` because picking the port needs top-level await.
- The e2e server gets its own `BETTER_AUTH_URL` (its random-port URL) and its own `DATABASE_URL`, a fresh file in the OS temp dir per run that the web server command migrates before `next dev` starts, so e2e never touches `data/app.db` or another checkout's database.
- `E2E_PORT`, `E2E_DIST_DIR` (default `.next-e2e`) and `E2E_DATABASE_URL` override port, output dir and database, e.g. for two e2e runs in the same checkout.
- Path aliases come from Vite 8's built-in `resolve.tsconfigPaths`, not from the `vite-tsconfig-paths` plugin the Next.js guide suggests.

## Gotchas

- `tsconfig.json` lists the `.next-e2e/` type globs on purpose; without them Next rewrites `tsconfig.json` on every e2e run.
- After an e2e run, the gitignored `next-env.d.ts` points at `.next-e2e/` types until the next `npm run dev` or `npm run build` points it back; this is harmless.
- The config is evaluated by the runner and by every worker, so the port, dist dir and database travel through their `E2E_*` env vars.
- Next adds the type globs of any dist dir that `tsconfig.json` does not list yet, so a custom `E2E_DIST_DIR` rewrites `tsconfig.json`; revert that, and name the dir `.next-e2e*` so it stays gitignored.
- Next reads `.env` but never overrides variables already set, which is why the e2e `DATABASE_URL` wins over the one in `.env`.
- Testing Library only auto-cleans the DOM with globals on, so `vitest.setup.ts` registers `cleanup` itself.
- The e2e smoke test fails on any browser console error, which catches hydration mismatches early.
