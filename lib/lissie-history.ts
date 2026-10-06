import "server-only";
import type { Message } from "@ag-ui/core";
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
 * User and assistant text under their stored ids, which the Mastra bridge
 * matches to skip history it already has. Lissie has no tools yet, so tool
 * calls are not restored; non-text parts are dropped.
 */
export function toChatMessages(stored: MastraDBMessage[]): Message[] {
  return stored.flatMap((message): Message[] => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = message.content.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("");
    if (!content) return [];
    return [{ id: message.id, role: message.role, content }];
  });
}
