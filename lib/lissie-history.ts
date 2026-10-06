import "server-only";
import type { Message, ToolCall } from "@ag-ui/core";
import type { MastraDBMessage } from "@mastra/core/agent/message-list";
import { mastra } from "./mastra";

/**
 * The conversation stored in Lissie's memory for a thread, as AG-UI messages
 * for the chat; empty for a thread that does not exist yet. Callers must have
 * checked that the thread belongs to the signed-in user: Mastra's memory does
 * no access control of its own.
 */
export async function loadLissieHistory(threadId: string): Promise<Message[]> {
  const memory = await mastra.getAgent("lissie").getMemory();
  if (!memory) return [];
  const thread = await memory.getThreadById({ threadId });
  if (!thread) return [];
  const { messages } = await memory.recall({
    threadId,
    resourceId: thread.resourceId,
    perPage: false,
  });
  return toChatMessages(messages);
}

/**
 * The stored conversation as the chat renders it: user text, assistant text,
 * and Lissie's tool calls with their results. A stored assistant message can
 * hold several steps (text, tool calls, more text); it becomes one AG-UI
 * assistant message per run of text followed by its tool calls, each call's
 * result as a tool message after it, as the live stream shows them. The first
 * keeps the stored id, which the Mastra bridge matches to skip history it
 * already has. Calls without a result (an aborted run) and other parts are
 * dropped.
 */
export function toChatMessages(stored: MastraDBMessage[]): Message[] {
  return stored.flatMap((message): Message[] => {
    if (message.role === "user") {
      const content = textOf(message.content.parts);
      return content ? [{ id: message.id, role: "user", content }] : [];
    }
    if (message.role === "assistant") return assistantSteps(message);
    return [];
  });
}

type Part = MastraDBMessage["content"]["parts"][number];

function textOf(parts: Part[]): string {
  return parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
}

function assistantSteps(message: MastraDBMessage): Message[] {
  type Step = { content: string; calls: ToolCall[]; results: Message[] };
  const steps: Step[] = [];
  const nextStep = () => {
    const step: Step = { content: "", calls: [], results: [] };
    steps.push(step);
    return step;
  };
  for (const part of message.content.parts) {
    const step = steps.at(-1);
    if (part.type === "text") {
      // Text after a tool call starts the next step.
      const target = !step || step.calls.length > 0 ? nextStep() : step;
      target.content += part.text;
    } else if (
      part.type === "tool-invocation" &&
      part.toolInvocation.state === "result"
    ) {
      const { toolCallId, toolName, args, result } = part.toolInvocation;
      const target = step ?? nextStep();
      target.calls.push({
        id: toolCallId,
        type: "function",
        function: { name: toolName, arguments: JSON.stringify(args ?? {}) },
      });
      target.results.push({
        id: `${toolCallId}-result`,
        role: "tool",
        toolCallId,
        content: JSON.stringify(result),
      });
    }
  }
  return steps.flatMap((step, index): Message[] => {
    if (!step.content && step.calls.length === 0) return [];
    const assistant: Message = {
      id: index === 0 ? message.id : `${message.id}-${index}`,
      role: "assistant",
      content: step.content,
      ...(step.calls.length > 0 ? { toolCalls: step.calls } : {}),
    };
    return [assistant, ...step.results];
  });
}
