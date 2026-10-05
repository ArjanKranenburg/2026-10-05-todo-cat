# Database

## Approach

- SQLite through `@libsql/client` and Drizzle ORM; `DATABASE_URL` (a `file:` URL, `file:./data/app.db` locally) names the database.
- `lib/db.ts` is the only module that opens the database; it imports `server-only`, so a Client Component importing it fails the build.
- `lib/schema.ts` defines or re-exports every table and is what drizzle-kit diffs; Better Auth's tables are generated into `lib/auth-schema.ts` (see [auth.md](auth.md)).
- `drizzle.config.ts` drives drizzle-kit; generated migrations land in `drizzle/` and are committed.

## Workflow

- Change `lib/schema.ts`, run `npm run db:generate` (`-- --name <what>` names the folder), review the SQL it writes to `drizzle/`, then `npm run db:migrate`; run `npm run format` too, since drizzle-kit writes `snapshot.json` in a format Biome rejects.
- `npm run db:reset` deletes the local database file and its journal files (`scripts/db-reset.mts`) and migrates a fresh one; it refuses non-`file:` URLs.
- `npm run db:seed` (`scripts/db-seed.mts`) deletes and re-creates the demo user through Better Auth, then seeds its to-dos through the todo service; timestamps are anchored to today's local midnight, so runs on the same day write the same rows.
- Do not use `drizzle-kit push`: every database (local, Vitest, e2e, CI) is built from the same reviewed migration files.

## Design decisions

- Drizzle is on the v1 release candidate (`drizzle-orm@rc`, `drizzle-kit@rc`) because the Drizzle docs and their install commands target v1; the stable 0.x API and migration folder layout differ. Move to `latest` once 1.0 ships.
- Both Drizzle packages are pinned exactly, because a caret range on a prerelease also matches Drizzle's branch snapshot builds (such as `1.0.0-rc.5-ab785fc`), which `npm update` would install.
- Migrations run through `drizzle-kit migrate` only, never at app startup, so there is one migration path for every environment.
- `drizzle.config.ts` and `scripts/db-reset.mts` load `.env` with `@next/env`, the loader Next.js uses, so they see the same values as the app; a variable already set in the environment wins, which is how tests and e2e point them at temp files.
- `@libsql/client` is on Next.js's built-in `serverExternalPackages` list, so `next.config.ts` needs no entry for it.

## Testing

- `lib/db.test.ts` runs `npm run db:migrate` against a temp file, then imports `lib/db.ts` with `DATABASE_URL` stubbed to that file and queries it; copy this pattern for tests that need a database.
- The Playwright web server command runs `db:migrate` before `next dev`, against the per-run temp database from `playwright.config.mts`.
- Vitest aliases `server-only` to its empty module (`vitest.config.mts`), since the real package throws outside the `react-server` condition that Next.js sets.

## Gotchas

- `lib/db.ts` reads `DATABASE_URL` when first imported, so tests must stub it before a dynamic `import()`.
- libsql needs the `file:` prefix; relative paths resolve against the working directory, which is the repo root for every npm script.
- In v1 the SQLite `drizzle()` config has no `schema` option; relational queries take `relations` (Relational Queries v2), so follow the v1 docs, not 0.x examples.
- `@next/env` is CommonJS without detectable named exports, so Node-run `.mts` scripts need its default import.
- A script that imports app modules (`lib/db.ts` and anything using it) runs with `tsx --conditions=react-server`: tsx resolves the extensionless imports plain Node rejects, and the condition makes `server-only` resolve to its empty module; load `.env` before the dynamic `import()` of `lib/db.ts`.
