import "server-only";
import { randomUUID } from "node:crypto";
import { type BaseEvent, EventType, type Message } from "@ag-ui/client";
import { MastraAgent } from "@ag-ui/mastra";
import {
  type AgentRunnerConnectRequest,
  type AgentRunnerRunRequest,
  CopilotRuntime,
  type CopilotRuntimeHooks,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import {
  MASTRA_RESOURCE_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import { defer, from, mergeAll, type Observable } from "rxjs";
import { loadLissieHistory } from "./lissie-history";
import { ownsLissieThread } from "./lissie-threads";
import { mastra } from "./mastra";
import { getUserId } from "./session";

// The CopilotKit runtime that serves Lissie to the chat over AG-UI
// (app/api/copilotkit, tech-docs/agent.md). It is also an authorization
// boundary: every route needs a session, and the only threads a user may run,
// connect to or stop are their own.

export const CHAT_BASE_PATH = "/api/copilotkit";
export const LISSIE_AGENT_ID = "lissie";

const unauthorized = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 });
// Same body as the runtime's own unknown routes, so another user's thread and
// a disabled route look exactly like something that does not exist.
const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

async function requireUserId(request: Request): Promise<string> {
  const userId = await getUserId(request.headers);
  if (!userId) throw unauthorized();
  return userId;
}

/** The `threadId` of a run or connect body; the handler still reads the original. */
async function bodyThreadId(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.clone().json();
    return typeof body === "object" && body !== null && "threadId" in body
      ? body.threadId
      : undefined;
  } catch {
    return undefined;
  }
}

const hooks: CopilotRuntimeHooks = {
  // Runs on every request before routing, unknown paths included.
  onRequest: async ({ request }) => {
    await requireUserId(request);
  },
  // An allowlist: a route not named here is answered 404. The default runner
  // serves its thread routes from one process-wide store that knows nothing
  // about users, so those are allowed on the caller's own threads only.
  onBeforeHandler: async ({ request, route }) => {
    const userId = await requireUserId(request);
    const owns = (threadId: unknown) => ownsLissieThread(userId, threadId);
    switch (route.method) {
      case "info":
        return;
      case "agent/run":
      case "agent/connect":
        if (
          route.agentId === LISSIE_AGENT_ID &&
          (await owns(await bodyThreadId(request)))
        ) {
          return;
        }
        throw notFound();
      case "agent/stop":
        if (route.agentId === LISSIE_AGENT_ID && (await owns(route.threadId))) {
          return;
        }
        throw notFound();
      // What the CopilotKit Inspector reads to show a thread.
      case "threads/messages":
      case "threads/events":
      case "threads/state":
        if (await owns(route.threadId)) return;
        throw notFound();
      // The runtime would list every user's threads; answer with the caller's.
      case "threads/list": {
        const threads = runner.listThreads();
        const own = await Promise.all(threads.map((t) => owns(t.id)));
        throw Response.json({
          threads: threads.filter((_, i) => own[i]),
          nextCursor: null,
        });
      }
      default:
        throw notFound();
    }
  },
};

/** Lissie's instructions come from the server only. */
function isConversation(message: Message): boolean {
  return message.role !== "system" && message.role !== "developer";
}

/**
 * The default in-memory runner for live runs, with history from Lissie's
 * memory: Mastra's store is the record, so a reload or a server restart
 * replays the whole conversation, not just the runs this process has seen.
 */
class LissieRunner extends InMemoryAgentRunner {
  override run(request: AgentRunnerRunRequest): Observable<BaseEvent> {
    const messages = request.input.messages.filter(isConversation);
    request.agent.setMessages(messages);
    return super.run({ ...request, input: { ...request.input, messages } });
  }

  override connect(request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    // A run in flight: join its live stream, as the default runner does.
    return defer(async () =>
      (await this.isRunning(request))
        ? super.connect(request)
        : history(request.threadId),
    ).pipe(mergeAll());
  }
}

async function history(threadId: string): Promise<Observable<BaseEvent>> {
  const runId = randomUUID();
  const messages = await loadLissieHistory(threadId);
  const events: BaseEvent[] = [
    { type: EventType.RUN_STARTED, threadId, runId },
    { type: EventType.MESSAGES_SNAPSHOT, messages },
    { type: EventType.RUN_FINISHED, threadId, runId },
  ];
  return from(events);
}

const runner = new LissieRunner();

const runtime = new CopilotRuntime({
  // Per request, so Lissie's memory resource and the owner her tools act for
  // (lib/lissie-tools.ts) are the signed-in user. The bridge files the
  // client's AG-UI `context` under its own `ag-ui` key and copies nothing else
  // from the request into this context.
  agents: async ({ request }) => {
    const userId = await requireUserId(request);
    return {
      // What MastraAgent.getLocalAgent builds, plus the A2UI switch it lacks.
      [LISSIE_AGENT_ID]: new MastraAgent({
        agentId: LISSIE_AGENT_ID,
        agent: mastra.getAgent(LISSIE_AGENT_ID),
        resourceId: userId,
        requestContext: new RequestContext([[MASTRA_RESOURCE_ID_KEY, userId]]),
        // The bridge would add a UI-generating tool (and a second model call)
        // whenever the request's forwardedProps ask for one.
        a2ui: { injectA2UITool: false },
      }),
    };
  },
  runner,
  // Renders the A2UI operations Lissie's own tools return (showProgress) as
  // cards in the chat. Her cards are authored, not generated: the middleware
  // must not inject its render tool, which a catalog on the client would
  // otherwise switch on.
  a2ui: { agents: [LISSIE_AGENT_ID], injectA2UITool: false },
  // By default the runtime copies the request's `authorization` and `x-*`
  // headers onto the agent, and the Mastra bridge sends them with every model
  // call: the user's session token would go to OpenRouter in place of our key.
  forwardHeaders: { deny: ["authorization"], denyPrefixes: ["x-"] },
});

export const chatHandler = createCopilotRuntimeHandler({
  runtime,
  basePath: CHAT_BASE_PATH,
  hooks,
});
