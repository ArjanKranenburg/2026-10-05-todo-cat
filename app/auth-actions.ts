"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { returnTo } from "@/lib/return-to";

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
  redirect(returnTo(field(formData, "next")));
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
  redirect(returnTo(field(formData, "next")));
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
