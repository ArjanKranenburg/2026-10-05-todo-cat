import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Shell } from "@/components/ui/shell";
import { db } from "@/lib/db";
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
    <Shell>
      <PageHeader title={`Hi, ${user.name}`}>
        Lissie is guarding your list. There is nothing on it yet.
      </PageHeader>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </Shell>
  );
}
