# Lissie, the agent

Lissie is a Mastra agent that the chat on `/` reaches through CopilotKit over AG-UI.

```
 components/chat/lissie-chat.tsx ──AG-UI over HTTP──▶ /api/copilotkit/[[...slug]]
   (CopilotKitProvider, CopilotChat)                    lib/chat-runtime.ts: hooks (auth), LissieRunner
                                                          │ MastraAgent.getLocalAgent (@ag-ui/mastra)
                                                          ▼
                       lib/mastra.ts ── lib/lissie.ts (agent, memory) ── lib/lissie-model.ts ──▶ OpenRouter
                            │
                            └─ memory tables in our SQLite file, on lib/db.ts's connection
```

## Packages

- `@mastra/core`, `@mastra/memory`, `@mastra/libsql`, `@ag-ui/mastra`, `@ag-ui/client`, `@ag-ui/core`, `@copilotkit/react-core` and `@copilotkit/runtime` are pinned to the exact versions this integration was built and tested with; upgrade them together and rerun the tests. `rxjs` is pinned to the 7.8.1 they all pin.
- Use only the v2 surfaces: `@copilotkit/runtime/v2` and `@copilotkit/react-core/v2`. The package roots are the deprecated v1 API and still import fine, then fail at runtime.
- Read the docs through the `mastra` and `copilotkit` skills; Mastra's embedded docs in `node_modules/@mastra/*/dist/docs/` match the installed version.

## The agent

- `lib/lissie.ts` holds the instructions (cat persona, declines everything that is not about the to-do list, may not pretend to change the list), the agent and `lissieThreadId(userId)`.
- She has no tools yet. When tools arrive, they call the todo service with the user id from the server session (see [architecture.md](architecture.md)), never from a tool argument, and the instructions' "what you cannot do yet" section goes.
- The model is `openrouter/${OPENROUTER_MODEL}` (default `z-ai/glm-5.3-flash`) through Mastra's model router, which reads `OPENROUTER_API_KEY` itself. `lib/lissie-model.ts` holds only that string, so tests can mock the module.
- Check a model id with `node .claude/skills/mastra/scripts/provider-registry.mjs --provider openrouter`.

## Memory

- One thread per user: thread id `lissie-<user id>`, resource id = the user id. The chat's AG-UI thread and Mastra's memory thread are the same id.
- `messageHistory: { maxTokens: 16_000 }` keeps the recent part of the never-ending thread in context; older messages stay in storage.
- Storage is a `MastraCompositeStore` with only the memory domain (`lib/mastra-storage.ts`) on `lib/db.ts`'s libsql client, so Mastra adds just `mastra_threads`, `mastra_messages`, `mastra_resources` and `mastra_observational_memory` to our file, and no second connection exists.
- The app builds it with `disableInit`; `npm run db:migrate` runs `scripts/mastra-migrate.mts` after the Drizzle migrations, which creates or updates those tables. Rerun it after upgrading `@mastra/*`. Drizzle neither knows nor touches them.
- Mastra's memory does no access control: `recall` and `getThreadById` return any thread they are asked for. Only the runtime's ownership check stands between users.

## The runtime is an authorization boundary

- `lib/chat-runtime.ts` builds the `CopilotRuntime` and its fetch handler; `app/api/copilotkit/[[...slug]]/route.ts` only exports it (multi-route mode, so `useSingleEndpoint={false}` in the provider).
- `onRequest` runs before routing on every request and answers 401 without a session (`getUserId`, cookie or bearer).
- `onBeforeHandler` is an allowlist: `info`; `agent/run` and `agent/connect` for agent `lissie` whose body `threadId` is the caller's own; `agent/stop` on the caller's own thread. Everything else answers 404 `{ "error": "Not found" }`, the runtime's own body for unknown routes, so another user's thread looks like nothing.
- The denied routes include the thread routes (`threads`, `threads/:id/messages|events|state`, `threads/clear`, ...): the default in-memory runner answers them from one process-wide store with no owner, so allowing them would list, read or wipe every user's conversation.
- The agents factory resolves the user again and passes it as `resourceId`; the factory runs for every request, so memory scope never comes from the client.
- `forwardHeaders` forwards no request headers. By default the runtime copies `authorization` and `x-*` from the request onto the agent, and the Mastra bridge sends them with every model call, which put the user's session token in place of the OpenRouter key.
- `LissieRunner.run` drops `system` and `developer` messages from the client, so Lissie's instructions come only from the server.
- `app/api/copilotkit/[[...slug]]/route.test.ts` checks every route the runtime serves (its list mirrors `fetch-router.mjs` in `@copilotkit/runtime`): 401 without a session, 404 outside the allowlist, no run, connect or stop on another user's thread (also while a run is in flight), memory owned by the user, history after a restart, and nothing from the request reaching the model. Extend it when a CopilotKit upgrade adds routes.

## History and restarts

- `LissieRunner` extends the in-memory runner. A run streams as usual; `connect` without a run in flight answers `RUN_STARTED`, a `MESSAGES_SNAPSHOT` from Mastra memory (`lib/lissie-history.ts`) and `RUN_FINISHED`, so a reload or a server restart shows the whole conversation. With a run in flight it joins the live stream.
- Snapshot messages keep their Mastra ids; the Mastra bridge drops incoming messages whose ids it has stored, so history the client sends back is not saved twice. The provider's `messageFilter` sends only the newest message anyway.
- History restores user and assistant text only. Tool calls are not restored yet; add them when Lissie gets tools.

## The chat UI

- `components/chat/lissie-chat.tsx` is the client component: `CopilotKitProvider` (runtime URL, agent `lissie`, inspector off) and `CopilotChat` with the server-computed `threadId`.
- An explicit `threadId` makes CopilotKit connect and replay on mount and disables its welcome screen.
- CopilotKit's v2 CSS is scoped to `[data-copilotkit]` with shadcn tokens whose names collide with ours (`--background`, `--muted`, `--accent`); `app/globals.css` maps our palette onto them through `--chat-*` aliases captured on the `.lissie-chat` wrapper.
- Its dark styles apply under a `.dark` ancestor only, so the wrapper sets `dark` from `prefers-color-scheme`.

## Testing

- `route.test.ts` replaces `lib/lissie-model.ts` with `MockLanguageModelV4` from `ai/test` (`ai` is a dev dependency only for this); its gate holds a run open for the in-flight tests.
- `e2e/chat.spec.ts` (in QA) checks that `/` shows the chat and connects, without calling the model.
- `e2e/lissie.model.spec.ts` talks to the real model and runs only with `npm run test:e2e:model`, never in QA or CI; it needs `OPENROUTER_API_KEY` in `.env`.

## Gotchas

- Mastra sends `x-thread-id` and `x-resource-id` (the user id) with every model call when memory is on; there is no option to turn it off.
- The runtime and Mastra log telemetry notices unless `COPILOTKIT_TELEMETRY_DISABLED` and `MASTRA_TELEMETRY_DISABLED` are set (`.env.example` sets both).
- `@ag-ui/mastra` pulls in `@mastra/client-js`, whose old `@ai-sdk/ui-utils` wants zod 3; npm warns about the peer range; runs and tests work with it.
- A CopilotKit dev build logs "Lit is in dev mode" as a warning; e2e only fails on console errors.
