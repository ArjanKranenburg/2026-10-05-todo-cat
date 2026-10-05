# Testing

## Strategy

- Vitest covers unit and integration tests: pure logic, zod schemas, synchronous components, route handlers and CLI code.
- Playwright covers end-to-end flows in a real browser against a real `next dev` server, Chromium only.
- `async` Server Components cannot be rendered by Vitest (Next.js testing guide), so test them end to end.
- Each tool has one smoke test (`app/page.test.tsx`, `e2e/smoke.spec.ts`) that proves the harness itself works.

## Commands

- `npm test` runs Vitest once; `npm run test:watch` keeps it watching.
- `npm run test:e2e` runs Playwright, which starts and stops its own dev server.
- `npx playwright install chromium` fetches the browser on a fresh machine.

## Conventions

- Vitest tests are colocated as `*.test.ts` / `*.test.tsx` anywhere in the repo, workspaces included; Playwright specs live in `e2e/` as `*.spec.ts`.
- The file extension picks the Vitest environment (`projects` in `vitest.config.mts`): `.test.tsx` runs in jsdom, `.test.ts` runs in Node.
- Import `test`/`expect` from `vitest` explicitly; Vitest globals are off.

## Design decisions

- The e2e dev server writes to `.next-e2e/` instead of `.next/` (`NEXT_DIST_DIR` in `next.config.ts`), because Next 16 locks `.next/dev` and a second `next dev` in the same directory exits even on another port.
- `playwright.config.mts` picks a free port on every run, so e2e never collides with `npm run dev` or other local servers; it is `.mts` because picking the port needs top-level await.
- Path aliases come from Vite 8's built-in `resolve.tsconfigPaths`, not from the `vite-tsconfig-paths` plugin the Next.js guide suggests.

## Gotchas

- `tsconfig.json` lists the `.next-e2e/` type globs on purpose; without them Next rewrites `tsconfig.json` on every e2e run.
- After an e2e run, the gitignored `next-env.d.ts` points at `.next-e2e/` types until the next `npm run dev` or `npm run build` points it back; this is harmless.
- The config is evaluated by the runner and by every worker, so the port travels through the `E2E_PORT` env var; setting it yourself pins the port.
- Testing Library only auto-cleans the DOM with globals on, so `vitest.setup.ts` registers `cleanup` itself.
- The e2e smoke test fails on any browser console error, which catches hydration mismatches early.
