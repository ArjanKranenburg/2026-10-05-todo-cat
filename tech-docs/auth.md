# Authentication

## Approach

- Better Auth with email and password only, on the Drizzle adapter over `lib/db.ts`; `better-auth`, `@better-auth/drizzle-adapter` and the `auth` CLI are pinned to the same exact version, since Better Auth releases them as one train.
- `lib/auth-options.ts` holds the whole configuration as `authOptions(db)`; `lib/auth.ts` builds the app instance from it and adds `nextCookies()`, and `app/api/auth/[...all]/route.ts` mounts it at `/api/auth`.
- `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` come from `.env`; Better Auth reads them itself.
- Plugins: `bearer()` lets the REST API and the CLI send `Authorization: Bearer <session token>`; `deviceAuthorization()` gives the CLI a `gh auth login` style login whose `/device/token` returns a Better Auth session token, which then goes out as that bearer token.
- The device flow only accepts the client id `CLI_CLIENT_ID` (`todo-cat-cli`, from the contract); its approval page is `/device` and its client is `todo-cat login` (see [cli.md](cli.md)).

## One way to ask who is signed in

- `getUserId(headers)` in `lib/session.ts` returns the signed-in user's id from the session cookie or the bearer token, or null.
- Pages, server actions, the chat runtime and every later adapter (REST, agent tools, MCP) call it; nothing else calls `auth.api.getSession` or reads session cookies.
- It returns only the id; load other user fields from the `user` table (as `app/page.tsx` does for the name).
- Each page checks on the server (`/` redirects to `/login`, `/login` and `/signup` redirect to `/` when signed in); there is no `proxy.ts`, because a cookie-only proxy check is not a security boundary.

## Sign-up, sign-in, sign-out

- They are server actions in `app/auth-actions.ts` that call `auth.api.*` with the request headers; `nextCookies()` makes those calls set and clear the session cookie, so no Better Auth React client is needed yet.
- `components/auth/auth-form.tsx` is the one form for both modes, built from `components/ui/`, which owns every shared class string; theme colors are tokens in `app/globals.css`.
- Better Auth's error message (such as "Invalid email or password") is shown as is, and the typed email survives a failed attempt.
- `/login` and `/signup` take a `next` path (kept when switching between them) and return there after signing in; `returnTo` in `lib/return-to.ts` drops anything that is not a path on this site, so the forms cannot redirect elsewhere.

## Schema

- `npm run db:auth-schema` runs the Better Auth CLI to regenerate `lib/auth-schema.ts` from the config (core tables plus the plugins' tables, such as `device_code`) and formats it with Biome; `lib/schema.ts` re-exports it.
- After changing plugins or options, run `db:auth-schema`, then the normal `db:generate` and `db:migrate` (see [database.md](database.md)); never edit `lib/auth-schema.ts` by hand.
- The adapter comes from `@better-auth/drizzle-adapter/relations-v2`, because Drizzle v1 uses Relations v2; the generated `authRelations` are passed to `drizzle()` in `lib/db.ts`, so `db.query.user` works.

## Testing

- `lib/auth.test.ts` builds a test-only instance from `authOptions(db)` plus `testUtils()` on a migrated temp database, and checks sign-up, sign-in and `getUserId` with a cookie, a bearer token and neither.
- `testUtils()` stays out of `lib/auth-options.ts`: it puts privileged helpers on the auth context.
- `e2e/auth.spec.ts` walks the real sign-up, sign-out and sign-in flow in the browser.

## Gotchas

- The Better Auth CLI cannot load a config that imports `server-only`, even transitively through `lib/db.ts`, and ignores `--conditions=react-server`; it therefore loads `scripts/auth-schema.mts`, which builds the same options on an in-memory database.
- `nextCookies()` must stay the last plugin, and it lives only in `lib/auth.ts`; tests call `auth.api` outside a Next.js request, where it has no cookies to set.
- Better Auth checks request origins against `BETTER_AUTH_URL`, so the Playwright web server sets it to its own random-port URL.
- React resets a form after its action runs, which clears the password field after a failed sign-in; e2e waits for that reset before typing again.
- Next.js renders its route announcer with `role="alert"`, so tests find form errors by their text, not by role.
