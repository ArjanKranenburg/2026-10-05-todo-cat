# Authentication

## Approach

- Better Auth with email and password, plus Google sign-in when it is configured, on the Drizzle adapter over `lib/db.ts`; `better-auth`, `@better-auth/drizzle-adapter` and the `auth` CLI are pinned to the same exact version, since Better Auth releases them as one train.
- `lib/auth-options.ts` holds the whole configuration as `authOptions(db)`; `lib/auth.ts` builds the app instance from it and adds `nextCookies()`, and `app/api/auth/[...all]/route.ts` mounts it at `/api/auth`.
- `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` come from `.env`; Better Auth reads them itself.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are optional; see Google sign-in below.
- Plugins: `bearer()` lets the REST API and the CLI send `Authorization: Bearer <session token>`; `deviceAuthorization()` gives the CLI a `gh auth login` style login whose `/device/token` returns a Better Auth session token, which then goes out as that bearer token.
- The device flow only accepts the client id `CLI_CLIENT_ID` (`todo-cat-cli`), and its approval page will live at `/device`; neither the page nor the CLI client exists yet.

## One way to ask who is signed in

- `getUserId(headers)` in `lib/session.ts` returns the signed-in user's id from the session cookie or the bearer token, or null.
- Pages, server actions, and every later adapter (REST, agent tools, MCP) call it; nothing else calls `auth.api.getSession` or reads session cookies.
- It returns only the id; load other user fields from the `user` table (as `app/page.tsx` does for the name).
- Each page checks on the server (`/` redirects to `/login`, `/login` and `/signup` redirect to `/` when signed in); there is no `proxy.ts`, because a cookie-only proxy check is not a security boundary.

## Sign-up, sign-in, sign-out

- They are server actions in `app/auth-actions.ts` that call `auth.api.*` with the request headers; `nextCookies()` makes those calls set and clear the session cookie, so no Better Auth React client is needed yet.
- `components/auth/auth-form.tsx` is the one form for both modes, built from `components/ui/`, which owns every shared class string; theme colors are tokens in `app/globals.css`.
- Better Auth's error message (such as "Invalid email or password") is shown as is, and the typed email survives a failed attempt.

## Google sign-in

- `googleCredentials()` in `lib/auth-options.ts` turns the provider on only when both env vars are set, and the sign-in pages show "Continue with Google" only then, so a checkout without credentials has no broken button.
- The Google OAuth client is of type "Web application" with the redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google`; add one per environment.
- `signInWithGoogle` in `app/auth-actions.ts` asks `auth.api.signInSocial` for Google's consent URL and redirects there; `nextCookies()` sets the OAuth state cookie. Better Auth's own callback route creates the user and session, so a Google user gets an ordinary session that `getUserId`, the bearer token and the device flow treat like any other.
- No schema change: Google lands in the existing `account` table (`providerId` `google`).
- Failed callbacks go to `/login?error=<code>`; the login page turns the code into a message.
- Account linking stays at Better Auth's default: a Google sign-in links to an existing user with the same email only when that user's email is verified. Email sign-up does not verify emails yet, so a matching password account gets `account_not_linked` instead; this stops someone from signing up with another person's email first and sharing their Google account later. Revisit once email verification exists.
- The `twoFactor` plugin, if added, gates only email, username and phone sign-in; Google sign-in would skip it.

## Schema

- `npm run db:auth-schema` runs the Better Auth CLI to regenerate `lib/auth-schema.ts` from the config (core tables plus the plugins' tables, such as `device_code`) and formats it with Biome; `lib/schema.ts` re-exports it.
- After changing plugins or options, run `db:auth-schema`, then the normal `db:generate` and `db:migrate` (see [database.md](database.md)); never edit `lib/auth-schema.ts` by hand.
- The adapter comes from `@better-auth/drizzle-adapter/relations-v2`, because Drizzle v1 uses Relations v2; the generated `authRelations` are passed to `drizzle()` in `lib/db.ts`, so `db.query.user` works.

## Testing

- `lib/auth.test.ts` builds a test-only instance from `authOptions(db)` plus `testUtils()` on a migrated temp database, and checks sign-up, sign-in and `getUserId` with a cookie, a bearer token and neither.
- Its Google tests run the real sign-in and callback routes and stub only Google's token endpoint (`fetch`); the provider decodes the returned id token without checking its signature, so an unsigned token works.
- `testUtils()` stays out of `lib/auth-options.ts`: it puts privileged helpers on the auth context.
- `e2e/auth.spec.ts` walks the real sign-up, sign-out and sign-in flow in the browser. For Google it stops at the consent URL via `page.route`, since the callback's token exchange runs on the server where the browser cannot stub it; the Playwright web server sets dummy Google credentials so the button shows.

## Gotchas

- The Better Auth CLI cannot load a config that imports `server-only`, even transitively through `lib/db.ts`, and ignores `--conditions=react-server`; it therefore loads `scripts/auth-schema.mts`, which builds the same options on an in-memory database.
- `nextCookies()` must stay the last plugin, and it lives only in `lib/auth.ts`; tests call `auth.api` outside a Next.js request, where it has no cookies to set.
- Better Auth checks request origins against `BETTER_AUTH_URL`, so the Playwright web server sets it to its own random-port URL.
- React resets a form after its action runs, which clears the password field after a failed sign-in; e2e waits for that reset before typing again.
- Next.js renders its route announcer with `role="alert"`, so tests find form errors by their text, not by role.
