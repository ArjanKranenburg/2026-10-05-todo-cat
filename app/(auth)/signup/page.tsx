import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { PageHeader } from "@/components/ui/page-header";
import { Shell } from "@/components/ui/shell";
import { returnTo } from "@/lib/return-to";
import { getUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  // Set by pages that need a signed-in user, such as /device.
  const next = returnTo((await searchParams).next);
  if (await getUserId(await headers())) redirect(next);

  return (
    <Shell>
      {/* A non-breaking hyphen keeps "to-dos" on one line. */}
      <PageHeader title="Hand your to‑dos to Lissie">
        She keeps the list. She will also have opinions about it.
      </PageHeader>
      <AuthForm mode="signUp" next={next} />
    </Shell>
  );
}
