# Lissie, the agent

Lissie is a Mastra agent that the chat on `/` reaches through CopilotKit over AG-UI.

```
 components/chat/lissie-chat.tsx ──AG-UI over HTTP──▶ /api/copilotkit/[[...slug]]
   (CopilotKitProvider, CopilotChat)                    lib/chat-runtime.ts: hooks (auth), LissieRunner
                                                          │ MastraAgent.getLocalAgent (@ag-ui/mastra)
                                                          ▼
                       lib/mastra.ts ── lib/lissie.ts (agent, memory) ── lib/lissie-model.ts ──▶ OpenRouter
                            │                  │
                            │                  └─ lib/lissie-tools.ts ──▶ lib/todo-service.ts
                            └─ memory tables in our SQLite file, on lib/db.ts's connection
```

## Packages

- `@mastra/core`, `@mastra/memory`, `@mastra/libsql`, `@ag-ui/mastra`, `@ag-ui/client`, `@ag-ui/core`, `@copilotkit/react-core` and `@copilotkit/runtime` are pinned to the exact versions this integration was built and tested with; upgrade them together and rerun the tests. `rxjs` is pinned to the 7.8.1 they all pin.
- Use only the v2 surfaces: `@copilotkit/runtime/v2` and `@copilotkit/react-core/v2`. The package roots are the deprecated v1 API and still import fine, then fail at runtime.
- Read the docs through the `mastra` and `copilotkit` skills; Mastra's embedded docs in `node_modules/@mastra/*/dist/docs/` match the installed version.

## The agent

- `lib/lissie.ts` holds the instructions (cat persona, declines everything that is not about the to-do list, comments in character on every to-do she adds or marks done, has opinions about "feed the cat") and the agent.
- The model needs today's date to turn "tomorrow" into a due date, and does not get it yet.

## Tools

- `listTodos`, `addTodo` and `setTodoDone` (`lib/lissie-tools.ts`) are an adapter on the todo service (see [architecture.md](architecture.md)); she cannot rename, reschedule or delete yet.
- `lib/lissie-tool-calls.ts` holds what the model and the chat share and has no server code: the tool names, their input schemas (the contract's, plus `SetTodoDoneInput`), and `describeToolCall`, the one line the chat shows per call.
- **The owner comes from the server session only.** The runtime's agents factory resolves the user per request and passes `requestContext: new RequestContext([[MASTRA_RESOURCE_ID_KEY, userId]])` to `getLocalAgent`; each tool reads that key and throws without it. `MASTRA_RESOURCE_ID_KEY` is Mastra's own key for the authenticated resource, which also wins over `memory.resource`.
- Nothing from the client reaches that context: the bridge files the AG-UI `context` under its own `ag-ui` key and ignores `forwardedProps` and `state` for it; the input schemas are strict, so a `userId` argument from the model fails validation.
- Mastra parses the input with the schema before `execute` and answers invalid input with a `{ error: true, message }` result. Tools return `TodoError`s as `{ error: { code, message } }` instead of throwing, because the bridge drops a thrown tool error and the chat would show the call as running forever.
- The model is `openrouter/${OPENROUTER_MODEL}` (default `z-ai/glm-5.3-flash`) through Mastra's model router, which reads `OPENROUTER_API_KEY` itself. `lib/lissie-model.ts` holds only that string, so tests can mock the module.
- Check a model id with `node .claude/skills/mastra/scripts/provider-registry.mjs --provider openrouter`.

## Memory

- A conversation is a Mastra memory thread whose resource id is the user id; the chat's AG-UI thread and the memory thread are the same id. `lib/lissie-threads.ts` owns them.
- The current conversation is the user's newest thread by `createdAt`. `/` starts one on a user's first visit, and the "New conversation" button (`app/chat-actions.ts`) starts another, which then is current. Old conversations stay in storage; nothing shows or deletes them yet.
- A new thread starts with an empty context: only message history is on (no semantic recall, no working memory), and it is per thread.
- New threads are `lissie-<random UUID>`, written with a `createdAt` strictly after the current one so a quick double start still orders. Threads from before multiple conversations are `lissie-<user id>` and work the same.
- `messageHistory: { maxTokens: 16_000 }` keeps the recent part of a long conversation in context; older messages stay in storage.
- Storage is a `MastraCompositeStore` with only the memory domain (`lib/mastra-storage.ts`) on `lib/db.ts`'s libsql client, so Mastra adds just `mastra_threads`, `mastra_messages`, `mastra_resources` and `mastra_observational_memory` to our file, and no second connection exists.
- The app builds it with `disableInit`; `npm run db:migrate` runs `scripts/mastra-migrate.mts` after the Drizzle migrations, which creates or updates those tables. Rerun it after upgrading `@mastra/*`. Drizzle neither knows nor touches them.
- Mastra's memory does no access control: `recall` and `getThreadById` return any thread they are asked for. Only the runtime's ownership check stands between users.

## The runtime is an authorization boundary

- `lib/chat-runtime.ts` builds the `CopilotRuntime` and its fetch handler; `app/api/copilotkit/[[...slug]]/route.ts` only exports it (multi-route mode, so `useSingleEndpoint={false}` in the provider).
- `onRequest` runs before routing on every request and answers 401 without a session (`getUserId`, cookie or bearer).
- A thread is the caller's when Lissie's memory records it with the caller's user id as resource (`ownsLissieThread`); a thread id nobody has started is nobody's, which is why threads are created before the chat runs on them.
- `onBeforeHandler` is an allowlist: `info`; `agent/run` and `agent/connect` for agent `lissie` whose body `threadId` is the caller's; `agent/stop`, `threads/:id/messages`, `threads/:id/events` and `threads/:id/state` on a caller's thread; and `threads`, which the hook answers itself with only the caller's threads. Everything else answers 404 `{ "error": "Not found" }`, the runtime's own body for unknown routes, so another user's thread looks like nothing.
- The default in-memory runner answers the thread routes from one process-wide store with no owner: its `threads` lists every user's threads and `threads/clear` wipes them all. That is why the list is built in the hook and why clear, rename, archive and delete stay denied.
- The thread reads exist for the CopilotKit Inspector, which lists threads on load (a 404 there is a console error) and reads a thread's messages, events and state; they only cover runs this process has seen.
- The agents factory resolves the user again and passes it as `resourceId`; the factory runs for every request, so memory scope never comes from the client.
- `forwardHeaders` forwards no request headers. By default the runtime copies `authorization` and `x-*` from the request onto the agent, and the Mastra bridge sends them with every model call, which put the user's session token in place of the OpenRouter key.
- `LissieRunner.run` drops `system` and `developer` messages from the client, so Lissie's instructions come only from the server.
- `app/api/copilotkit/[[...slug]]/route.test.ts` checks every route the runtime serves (its list mirrors `fetch-router.mjs` in `@copilotkit/runtime`): 401 without a session, 404 outside the allowlist, no run, connect or stop on another user's thread or on one nobody started (also while a run is in flight), memory owned by the user, a new conversation that is current and starts with an empty context, history after a restart, and nothing from the request reaching the model. Extend it when a CopilotKit upgrade adds routes.

## History and restarts

- `LissieRunner` extends the in-memory runner. A run streams as usual; `connect` without a run in flight answers `RUN_STARTED`, a `MESSAGES_SNAPSHOT` from Mastra memory (`lib/lissie-history.ts`) and `RUN_FINISHED`, so a reload or a server restart shows the whole conversation. With a run in flight it joins the live stream.
- Snapshot messages keep their Mastra ids; the Mastra bridge drops incoming messages whose ids it has stored, so history the client sends back is not saved twice. The provider's `messageFilter` sends only the newest message anyway.
- History restores user text, assistant text and tool calls with their results. Mastra stores one assistant message per turn with text and `tool-invocation` parts interleaved; `toChatMessages` splits it into one AG-UI assistant message per run of text and its tool calls (the first keeps the stored id, the others get `-1`, `-2`, ...), each followed by its results as `tool` messages, which is how the live stream shows them. A call without a result is dropped.

## The chat UI

- `components/chat/lissie-chat.tsx` is the client component: `CopilotKitProvider` (runtime URL, agent `lissie`) and `CopilotChat` with the server-computed `threadId`.
- `components/chat/lissie-tool-calls.tsx` registers a `useRenderTool` renderer per tool that draws `describeToolCall`'s line (running, done or failed), live and in replayed history. Text inside the chat must use the `--chat-*` aliases: CopilotKit redefines `--muted` there, which makes `text-muted` nearly invisible.
- The to-do sidebar (`components/chat/todo-sidebar.tsx`) is server-rendered from `listTodos` and read-only. `LissieToolCalls` subscribes to the agent's events and calls `router.refresh()` when a result of `addTodo` or `setTodoDone` arrives; a replay arrives as a snapshot and refreshes nothing.
- `app/page.tsx` keys `LissieChat` by thread id, so a new conversation (the server action calls `refresh()`) mounts a fresh provider and chat instead of carrying the old messages over.
- The CopilotKit Inspector is on; CopilotKit itself shows it only in development builds on localhost. `COPILOTKIT_INSPECTOR_DISABLED=true` hides it; `app/page.tsx` reads it on the server per request, so a dev server restart (or `.env` reload) applies it without a rebuild. It needs no runtime route beyond the thread reads above; the runtime's `cpk-debug-events` feed, which streams every user's events, stays denied.
- An explicit `threadId` makes CopilotKit connect and replay on mount and disables its welcome screen.
- CopilotKit's v2 CSS is scoped to `[data-copilotkit]` with shadcn tokens whose names collide with ours (`--background`, `--muted`, `--accent`); `app/globals.css` maps our palette onto them through `--chat-*` aliases captured on the `.lissie-chat` wrapper.
- Its dark styles apply under a `.dark` ancestor only, so the wrapper sets `dark` from `prefers-color-scheme`.
- Only the conversation scrolls: `Shell`'s `wide` variant is exactly `h-dvh` and, unlike `narrow`, not `flex-1`, because a growing flex item's minimum height is its content and the page would grow with the chat. `CopilotChat` (`min-h-0 flex-1`) pins its input to its own bottom and scrolls its message list.

## Testing

- `route.test.ts` replaces `lib/lissie-model.ts` with `MockLanguageModelV4` from `ai/test` (`ai` is a dev dependency only for this); its gate holds a run open for the in-flight tests, and `model.toolCalls` scripts tool calls, one batch per model call, before the reply. Its tool tests check that the owner ignores the request's `context`, `forwardedProps` and `state`, that the model cannot pass one, and that tool calls replay after a restart.
- `lib/lissie-tools.test.ts` runs the tool executors on a temp database with two users; `lib/lissie-tool-calls.test.ts` covers the chat's lines.
- `e2e/chat.spec.ts` (in QA) checks that `/` shows the chat and connects, that a long conversation (seeded through Mastra's memory store into the e2e database) scrolls inside the chat while the page does not, that "New conversation" empties the chat for good, that the sidebar shows open and done to-dos without controls, and that seeded tool calls replay as one line each, all without calling the model.
- `e2e/lissie.model.spec.ts` talks to the real model and runs only with `npm run test:e2e:model`, never in QA or CI; it needs `OPENROUTER_API_KEY` in `.env`. It asks Lissie to add "buy milk" and finds it in the sidebar without a reload.

## Gotchas

- Mastra sends `x-thread-id` and `x-resource-id` (the user id) with every model call when memory is on; there is no option to turn it off.
- The runtime and Mastra log telemetry notices unless `COPILOTKIT_TELEMETRY_DISABLED` and `MASTRA_TELEMETRY_DISABLED` are set (`.env.example` sets both).
- `@ag-ui/mastra` pulls in `@mastra/client-js`, whose old `@ai-sdk/ui-utils` wants zod 3; npm warns about the peer range; runs and tests work with it.
- A CopilotKit dev build logs "Lit is in dev mode" as a warning; e2e only fails on console errors.
