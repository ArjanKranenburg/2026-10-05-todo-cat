import "server-only";
import { randomUUID } from "node:crypto";
import { mastra } from "./mastra";

// A user's conversations with Lissie are Mastra memory threads whose resource
// is the user id; the newest is the current one (tech-docs/agent.md). The chat's
// AG-UI thread and the memory thread are the same id.

async function lissieMemory() {
  const memory = await mastra.getAgent("lissie").getMemory();
  if (!memory) throw new Error("Lissie has no memory");
  return memory;
}

async function newestThread(userId: string) {
  const memory = await lissieMemory();
  const { threads } = await memory.listThreads({
    filter: { resourceId: userId },
    orderBy: { field: "createdAt", direction: "DESC" },
    perPage: 1,
  });
  return threads[0];
}

/** The conversation the chat shows: the user's newest, started if they have none. */
export async function currentLissieThread(userId: string): Promise<string> {
  return (await newestThread(userId))?.id ?? startLissieThread(userId);
}

/** Starts an empty conversation that becomes the user's current one. */
export async function startLissieThread(userId: string): Promise<string> {
  const newest = await newestThread(userId);
  // Strictly newer than the current one, even within the same millisecond.
  const createdAt = new Date(
    Math.max(
      Date.now(),
      (newest ? new Date(newest.createdAt).getTime() : 0) + 1,
    ),
  );
  const thread = await (await lissieMemory()).saveThread({
    thread: {
      id: `lissie-${randomUUID()}`,
      title: "",
      resourceId: userId,
      createdAt,
      updatedAt: createdAt,
    },
  });
  return thread.id;
}

/**
 * Whether the thread exists and is the user's. Mastra's memory does no access
 * control of its own, so this is the check between users; a thread nobody has
 * started is nobody's.
 */
export async function ownsLissieThread(
  userId: string,
  threadId: unknown,
): Promise<boolean> {
  if (typeof threadId !== "string") return false;
  const thread = await (await lissieMemory()).getThreadById({ threadId });
  return thread?.resourceId === userId;
}
