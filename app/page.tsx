import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { newConversation } from "@/app/chat-actions";
import { LissieChat } from "@/components/chat/lissie-chat";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Shell } from "@/components/ui/shell";
import { db } from "@/lib/db";
import { currentLissieThread } from "@/lib/lissie-threads";
import { getUserId } from "@/lib/session";

// COPILOTKIT_INSPECTOR_DISABLED=true (or 1) hides the CopilotKit Inspector,
// following the convention of CopilotKit's own COPILOTKIT_TELEMETRY_DISABLED.
function inspectorDisabled(): boolean {
  const value = process.env.COPILOTKIT_INSPECTOR_DISABLED;
  return value === "true" || value === "1";
}

export default async function Home() {
  const userId = await getUserId(await headers());
  if (!userId) redirect("/login");

  const user = await db.query.user.findFirst({
    where: { id: userId },
    columns: { name: true },
  });
  if (!user) redirect("/login");
  const threadId = await currentLissieThread(userId);

  return (
    <Shell width="wide">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={`Hi, ${user.name}`}>
          Lissie is guarding your list. Ask her about it, if you must.
        </PageHeader>
        <div className="flex shrink-0 gap-2">
          <form action={newConversation}>
            <Button type="submit" variant="secondary">
              New conversation
            </Button>
          </form>
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      </div>
      {/* A new conversation is a fresh chat, not the old one's state reused. */}
      <LissieChat
        key={threadId}
        threadId={threadId}
        inspector={!inspectorDisabled()}
      />
    </Shell>
  );
}
