import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { PageHeader } from "@/components/ui/page-header";
import { Shell } from "@/components/ui/shell";
import { getUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getUserId(await headers())) redirect("/");

  return (
    <Shell>
      <PageHeader title="Back already?">
        Lissie kept your list. Sign in to see it.
      </PageHeader>
      <AuthForm mode="signIn" />
    </Shell>
  );
}
