import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { PageHeader } from "@/components/ui/page-header";
import { Shell } from "@/components/ui/shell";
import { googleCredentials } from "@/lib/auth-options";
import { getUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getUserId(await headers())) redirect("/");

  return (
    <Shell>
      {/* A non-breaking hyphen keeps "to-dos" on one line. */}
      <PageHeader title="Hand your to‑dos to Lissie">
        She keeps the list. She will also have opinions about it.
      </PageHeader>
      <AuthForm mode="signUp" google={googleCredentials() !== null} />
    </Shell>
  );
}
