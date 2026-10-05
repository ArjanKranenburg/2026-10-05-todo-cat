# REST API

The REST adapter of the todo service (see [architecture.md](architecture.md)) for non-browser clients such as the CLI.

## Endpoints

Schemas are from `@todo-cat/contract`; every error body is `ErrorBody`, and every endpoint answers 401 `unauthorized` without a valid token.

- `GET /api/todos?status=&search=`: query `TodoListFilter` → 200 `TodoList`; 400 `validation-failed`.
- `POST /api/todos`: body `CreateTodoInput` → 201 `Todo` with `Location: /api/todos/<id>`; 400 `validation-failed`.
- `GET /api/todos/<id>` → 200 `Todo`; 404 `todo-not-found`.
- `PATCH /api/todos/<id>`: body `UpdateTodoInput` → 200 `Todo`; 400 `validation-failed`, 404 `todo-not-found`.
- `DELETE /api/todos/<id>` → 204 without a body; 404 `todo-not-found`.

## The OpenAPI document

- `GET /api/openapi.json` serves an OpenAPI 3.1 document without a token, for clients outside this repository (other languages, generators, agents); `openapi.json` at the repo root is its committed copy.
- `lib/openapi.ts` builds it from the contract schemas with zod-openapi; `.meta({ id })` in `contract/src/todo.ts` names a component, and an operation there needs adding with every new route.
- The CLI does not use it: it imports the contract, which keeps the normalization, refinements and strictness that JSON Schema cannot carry. A generated client was tried and rejected for that reason.
- The document may accept input the server rejects (a blank title), never the reverse: limits that apply after normalization stay out of it (`override` in the contract), and `lib/openapi.test.ts` checks this against the server schemas.
- After changing a schema or `lib/openapi.ts`, run `npm run openapi:generate`; `lib/openapi.test.ts` fails until `openapi.json` matches. A version bump in `package.json` needs it too, since `info.version` comes from there.

## Getting a bearer token with curl

Sign up once (`/api/auth/sign-up/email` with `name`, `email`, `password`), or use the seeded demo user; the bearer plugin returns the session token in the `set-auth-token` response header:

```sh
TOKEN=$(curl -s -D - -o /dev/null -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"demo@todo-cat.dev","password":"cat-person-2026"}' \
  | awk 'tolower($1)=="set-auth-token:" {print $2}' | tr -d '\r')
curl -s 'http://localhost:3000/api/todos?status=open' -H "authorization: Bearer $TOKEN"
```

## Design decisions

- The route files (`app/api/todos/route.ts`, `app/api/todos/[id]/route.ts`) only pick the schema and the service call; `lib/rest.ts` holds the shared steps: authenticate, parse, map errors.
- Authentication comes first, so an anonymous request learns nothing about its input; invalid input is rejected before the service runs, so an empty patch to an unknown id is 400, not 404.
- Validation messages are one sentence per zod issue, prefixed with the field path (`title: A to-do needs a title.`), built by the contract's `describeIssues`, which the CLI uses for its own input checks too; clients switch on the code, never the message.
- A 401 carries `WWW-Authenticate: Bearer`; unexpected errors are not mapped and surface as Next.js 500s.
- The browser session cookie is accepted too, because `getUserId` reads both.

## Gotchas

- Query parameters go through the strict `TodoListFilter`, so an unknown parameter is a 400, and a repeated one keeps its last value.
- A body that is not JSON is 400 `validation-failed`, whatever its content type.
- Methods without a handler (such as `PUT`) get Next.js's own 405, not an `ErrorBody`.

## Tests

- `app/api/todos/route.test.ts` calls the route handlers on a migrated temp database and gets real tokens by signing up through the app's own `/api/auth` route handler, exactly like the curl recipe.
