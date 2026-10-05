"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type AuthFormState = { error: string | null; email: string };

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signUp(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim();
  try {
    // Signs the new user in as well; nextCookies() sets the session cookie.
    await auth.api.signUpEmail({
      body: {
        name: field(formData, "name").trim(),
        email,
        password: field(formData, "password"),
      },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) return { error: error.message, email };
    throw error;
  }
  redirect("/");
}

export async function signIn(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim();
  try {
    await auth.api.signInEmail({
      body: { email, password: field(formData, "password") },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) return { error: error.message, email };
    throw error;
  }
  redirect("/");
}

export async function signInWithGoogle(): Promise<void> {
  // Better Auth stores the OAuth state and returns Google's consent URL;
  // its /api/auth/callback/google route finishes the sign-in and sets the session.
  const { url } = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/", errorCallbackURL: "/login" },
    headers: await headers(),
  });
  if (!url) throw new Error("Better Auth returned no Google sign-in URL");
  redirect(url);
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
