"use client";

import { useActionState } from "react";
import { type AuthFormState, signIn, signUp } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Form, FormError } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { TextLink } from "@/components/ui/text-link";

const modes = {
  signUp: {
    action: signUp,
    submit: "Create account",
    pending: "Creating account…",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/login",
  },
  signIn: {
    action: signIn,
    submit: "Sign in",
    pending: "Signing in…",
    switchPrompt: "New here?",
    switchLabel: "Create an account",
    switchHref: "/signup",
  },
} as const;

const initialState: AuthFormState = { error: null, email: "" };

export function AuthForm({ mode }: { mode: keyof typeof modes }) {
  const copy = modes[mode];
  const [state, formAction, pending] = useActionState(
    copy.action,
    initialState,
  );

  return (
    <>
      <Form action={formAction}>
        {mode === "signUp" && (
          <TextField label="Name" name="name" autoComplete="name" required />
        )}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "signUp" ? "new-password" : "current-password"}
          minLength={8}
          required
        />
        <FormError message={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? copy.pending : copy.submit}
        </Button>
      </Form>
      <p className="text-muted">
        {copy.switchPrompt}{" "}
        <TextLink href={copy.switchHref}>{copy.switchLabel}</TextLink>
      </p>
    </>
  );
}
