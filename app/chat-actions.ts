"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { startLissieThread } from "@/lib/lissie-threads";
import { getUserId } from "@/lib/session";

/** Starts a new conversation with Lissie; the page then shows it, empty. */
export async function newConversation(): Promise<void> {
  const userId = await getUserId(await headers());
  if (!userId) redirect("/login");
  await startLissieThread(userId);
  refresh();
}
