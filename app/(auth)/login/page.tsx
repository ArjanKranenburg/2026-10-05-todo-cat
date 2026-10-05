import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { PageHeader } from "@/components/ui/page-header";
import { Shell } from "@/components/ui/shell";
import { googleCredentials } from "@/lib/auth-options";
import { getUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

// Better Auth sends a failed Google sign-in back here with `?error=<code>`.
function googleErrorMessage(code: string | string[] | undefined) {
  if (typeof code !== "string") return null;
  if (code === "account_not_linked") {
    return "That email already has an account. Sign in with your password.";
  }
  return "Google sign-in didn't work. Try again.";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (await getUserId(await headers())) redirect("/");
  const { error } = await searchParams;

  return (
    <Shell>
      <PageHeader title="Back already?">
        Lissie kept your list. Sign in to see it.
      </PageHeader>
      <AuthForm
        mode="signIn"
        google={googleCredentials() !== null}
        error={googleErrorMessage(error)}
      />
    </Shell>
  );
}
