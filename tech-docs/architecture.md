# Architecture

todo-cat has one piece of business logic, the todo service, and several thin adapters
around it. Hexagonal (ports and adapters), without the ceremony.

```
 browser pages ─┐
 REST /api/todos ┤                       ┌──────────────┐
 agent tools  ───┼── getUserId(headers) ─▶ todo service ├──▶ lib/db.ts ──▶ SQLite
 MCP over HTTP ──┘                       └──────┬───────┘
                                                │ types and schemas
 CLI and stdio MCP ──▶ REST /api/todos     contract/ (@todo-cat/contract, zod)
```

## The todo service

- One module, `lib/todo-service.ts`, holds every todo query and rule. Nothing else
  touches the `todos` table (tests may read it).
- Use cases, not tables: list (filter by status open/done/all and by text), get, add,
  update (title, due date, done), delete.
- **Every function takes the user id first, and every query filters by it.** There is
  no function that reads or writes todos without an owner.
- Another user's todo is "not found", never "forbidden": the API must not reveal that
  an id exists.
- The service returns contract types (plain objects, dates as ISO strings), never
  Drizzle rows.
- Rule violations are a few typed errors with stable codes (`todo-not-found`,
  `validation-failed`). Adapters map them; they don't invent their own.
- The service throws `TodoError` (its `code` is the contract's `ErrorCode`); today
  only `todo-not-found`. `validation-failed` comes from the adapter's schema parse.
- `seedTodos` replaces a user's todos with backdated ones for `npm run db:seed`
  (`scripts/db-seed.mts`); it is the only way to set timestamps, and no adapter
  exposes it.

## Data

- `todos` (in `lib/schema.ts`): id, owner (`user_id`, cascade delete with the user),
  title, optional due date, done, created at, completed at.
- Ids are random UUIDs, so they reveal nothing about other users' todos.
- Check constraints guard what the service maintains: a due date is a real
  `yyyy-mm-dd` day, and `completed_at` is set exactly when `done` is.
- A due date is a date without time and stays an ISO `yyyy-mm-dd` string everywhere.
  A JavaScript `Date` is midnight UTC and shows the previous day west of Greenwich.
- `completed at` is set when a todo is marked done and cleared when it's reopened;
  marking a done todo done again keeps the first time.
- Lists come open first, then by due date (none last), then oldest first.

## The contract

- The `contract/` workspace (`@todo-cat/contract`, `contract/src/todo.ts`) holds the
  zod schemas for todos, inputs, list filters, and the error body
  `{ error: { code, message } }`, plus `describeIssues` (the `validation-failed`
  message) and the CLI's device-flow client id and user-code format
  (`contract/src/auth.ts`).
- Each schema and its type share a name (`Todo`, `CreateTodoInput`, ...); input types
  are the parsed output (title trimmed, filter defaults applied), which is what the
  service takes.
- The package exports its TypeScript source without a build step; Next.js (Turbopack),
  Vitest and tsx compile it themselves, and the CLI's bundler inlines it.
- Server and clients import the same schemas. The CLI parses every response with
  them, so a server change that breaks the shape fails loudly in the client.
- Clients outside this repository get the same schemas as an OpenAPI document
  derived from them (`lib/openapi.ts`, `/api/openapi.json`); see [rest-api.md](rest-api.md).
- Validation lives in the schemas, at the adapter boundary. The service trusts its
  typed input but always enforces ownership.

## Adapters

- An adapter does four things: parse the input with a contract schema, resolve the
  user with `getUserId` (from `lib/session.ts`), call the service, map errors to its
  protocol. No business rules in adapters.
- **REST** (`/api/todos`): for non-browser clients. Bearer token or session cookie,
  401 `unauthorized` without either, 404 `todo-not-found`, 400 `validation-failed`;
  see [rest-api.md](rest-api.md).
- **CLI** (`cli/`): a client of the REST API, never of the database; see [cli.md](cli.md).
- **Chat** (`/api/copilotkit`): Lissie over CopilotKit and AG-UI; it is the browser's only write path to the list; see [agent.md](agent.md).
- **Agent tools** (`lib/lissie-tools.ts`): `listTodos`, `addTodo`, `setTodoDone` call the
  service directly. The user id comes from the server session through Mastra's request
  context, never from a tool argument the model fills in; service errors become the
  tool's `{ error: { code, message } }` result.
- **MCP**: over stdio inside the CLI (a REST client again), over HTTP inside the app
  (calls the service, like the REST routes).

## Gotchas

- Input schemas are strict: unknown fields fail with `validation-failed` instead of
  being dropped, so a typo like `complete: true` is not a silent no-op.
- `UpdateTodoInput` rejects an empty patch; the service itself treats one as a get.
- `TodoListFilter` defaults to status `all`; adapters that want open todos ask for them.
- Search is a substring match on the title with SQLite `lower()`, which folds ASCII
  letters only, so "ä" does not match "Ä".

## Deliberately not done

- No generic repository, unit of work, or DI container. The service module is the seam;
  tests run it against a temp SQLite file.
- No pagination, sharing between users, soft delete, or optimistic concurrency.

## Tests

- The service is tested against a temp database with **two users for every use case**:
  one user never sees, changes, or deletes the other's todos (`lib/todo-service.test.ts`).
- Adapter tests cover only the mapping: 401 without a user, error codes, status codes;
  the agent tools' tests (`lib/lissie-tools.test.ts`) cover the owner from the request
  context and the error results.