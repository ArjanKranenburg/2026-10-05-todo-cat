# CLI

`todo-cat` (workspace `cli/`, package `todo-cat-cli`) is a client of the REST API (see [rest-api.md](rest-api.md)), built on commander.js. AI agents working for a human are its main users; humans use it too.

## Layout

- `cli/src/main.ts` is the bin entry; `program.ts` declares the commands, the help texts and the exit-code mapping, and `run(argv, io)` takes its environment and output streams as arguments.
- `api.ts` is the REST client, `auth.ts` does login, logout and whoami through Better Auth's client, `config.ts` finds the server URL and keeps the credentials file, `errors.ts` holds `CliError`, the error codes and the exit codes, and `format.ts` the text output.
- tsdown bundles `src/main.ts` into `cli/dist/todo-cat.mjs` (`cli/tsdown.config.ts`); runtime dependencies stay external, and `@todo-cat/contract` is a devDependency because it is TypeScript source that has to be bundled.
- The workspace's `prepare` script builds it, so `npm install` and `npm ci` leave a working `npx todo-cat` at the repo root; `npm run build -w todo-cat-cli` rebuilds it after a change.

## Commands

- `list` (open to-dos by default, `--status`, `--search`), `show`, `add`, `done`, `reopen`, `edit` (`--title`, `--due`, `--no-due`) and `delete` map one to one onto the REST use cases; `login`, `logout` and `whoami` handle the session.
- To-do commands parse their input with the contract's input schemas before sending, and every response with `Todo` or `TodoList`, so invalid input fails without a request and a changed server shape fails loudly.
- `--json` prints the contract types on stdout (`delete` prints `{ id, deleted }`, login and whoami `{ server, user }`), and errors as `ErrorBody`-shaped JSON on stderr.

## Agent-friendly by design

- Results go to stdout, everything else to stderr; text errors read `error [<code>]: <message>`.
- Error codes are the API's `ErrorCode`s plus the CLI's own (`usage`, `login-denied`, `login-expired`, `server-unreachable`, `unexpected-response`, `unexpected-error`); the exit code follows from the code (`EXIT_CODE` in `errors.ts`) and is listed in `todo-cat --help`.
- Nothing prompts: `delete` refuses without `--yes`, and usage errors (commander's included) come out in the same format, as JSON when `--json` appears anywhere before `--`.
- Every command's `--help` ends with examples.
- The project skill `.claude/skills/todo-cat-cli/` teaches agents the workflows and pitfalls that `--help` can't (login etiquette, finding by title, `--json` with jq, which date a question means, when to delete); update it when a command's behavior changes, and keep `--help` the source of truth.

## Login

- `login` runs Better Auth's device authorization flow (RFC 8628) like `gh auth login`: it prints the code and the `verification_uri_complete` link to stderr, never opens a browser, and polls `/device/token` at the server's interval (5 s) until the code is approved, denied or expired (30 min).
- The approval page is `app/device/page.tsx`: it sends signed-out users through `/login?next=...`, claims the code for the signed-in user (Better Auth's `GET /device`, `checkDeviceCode` in `lib/device.ts`), then approves or denies it in a server action.
- The token is a Better Auth session token, sent as `Authorization: Bearer`; `whoami` reads `/api/auth/get-session`, and `logout` calls `/api/auth/sign-out`, which revokes the session, before forgetting the token.
- The client id `CLI_CLIENT_ID` and `formatUserCode` live in the contract, so the server's `validateClient` and the CLI cannot drift apart, and the page shows the code exactly as the terminal does (`ABCD-EFGH`), which the user is asked to compare.

## Server and credentials

- `TODO_CAT_URL` overrides the server, `http://localhost:3000` by default.
- Tokens live in `credentials.json` in the user's config directory (`TODO_CAT_CONFIG_DIR`, else `$XDG_CONFIG_HOME/todo-cat` or `~/.config/todo-cat`, `%APPDATA%\todo-cat` on Windows), never in the repo.
- The file maps each server URL to its token, so a token is only ever sent to the server that issued it, even after `TODO_CAT_URL` changes.
- It is written as a fresh `0600` file in a `0700` directory and renamed into place, so it is never readable by others, not even briefly.
- No command prints the token; the end-to-end test checks every output for it.

## Tests

- `cli/src/todo-cat.test.ts` builds the CLI, migrates a temp database, starts `next dev` on a spare port with its own dist dir (`.next-e2e-cli`), and drives the `todo-cat` bin with a temp config directory through login, whoami, add, list, done, delete and logout.
- It approves the device code through a test-only Better Auth instance with `testUtils()` on the same database (`deviceVerify`, then `deviceApprove`), so no browser is involved; the login step waits one 5 s polling interval.
- `e2e/device.spec.ts` covers the approval page in the browser: the detour through sign-up, approve, deny, and an unknown code.
- `config.test.ts` and `format.test.ts` are plain unit tests.

## Gotchas

- `npx todo-cat` runs `cli/dist/`, not the source: rebuild after changing `cli/src/`; the end-to-end test rebuilds by itself.
- `next dev` in the test runs without Vitest's `NODE_ENV=test`, and in its own process group so that stopping it also stops its workers.
- Better Auth's `GET /device` claims a pending code for the first signed-in user who opens it; only that user can approve or deny it afterwards.
- `/api/auth/sign-out` answers success even for an unknown token, so `logout` also clears a token whose session has already expired.
