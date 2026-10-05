"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type AuthFormState,
  signIn,
  signInWithGoogle,
  signUp,
} from "@/app/auth-actions";
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

type AuthFormProps = {
  mode: keyof typeof modes;
  // Show "Continue with Google"; only when Google credentials are configured.
  google: boolean;
  // An error to show before the first submit, such as a failed Google sign-in.
  error?: string | null;
};

export function AuthForm({ mode, google, error = null }: AuthFormProps) {
  const copy = modes[mode];
  const [state, formAction, pending] = useActionState(copy.action, {
    error,
    email: "",
  } satisfies AuthFormState);

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
      {google && (
        <Form action={signInWithGoogle}>
          <GoogleButton />
        </Form>
      )}
      <p className="text-muted">
        {copy.switchPrompt}{" "}
        <TextLink href={copy.switchHref}>{copy.switchLabel}</TextLink>
      </p>
    </>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Opening Google…" : "Continue with Google"}
    </Button>
  );
}
