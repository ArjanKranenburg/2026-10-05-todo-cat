import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { LissieChat } from "@/components/chat/lissie-chat";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Shell } from "@/components/ui/shell";
import { db } from "@/lib/db";
import { lissieThreadId } from "@/lib/lissie";
import { getUserId } from "@/lib/session";

export default async function Home() {
  const userId = await getUserId(await headers());
  if (!userId) redirect("/login");

  const user = await db.query.user.findFirst({
    where: { id: userId },
    columns: { name: true },
  });
  if (!user) redirect("/login");

  return (
    <Shell width="wide">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={`Hi, ${user.name}`}>
          Lissie is guarding your list. Ask her about it, if you must.
        </PageHeader>
        <form action={signOut} className="shrink-0">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
      <LissieChat threadId={lissieThreadId(userId)} />
    </Shell>
  );
}
