"use client";

import { useActionState } from "react";
import { type DeviceDecisionState, decideDevice } from "@/app/device/actions";
import { Button } from "@/components/ui/button";
import { Form, FormError } from "@/components/ui/form";

const initialState: DeviceDecisionState = { result: null, error: null };

// Approve and Deny for one claimed user code; the pressed button's
// `decision` value tells the action which one.
export function DeviceApproval({ userCode }: { userCode: string }) {
  const [state, formAction, pending] = useActionState(
    decideDevice,
    initialState,
  );

  if (state.result) {
    return (
      <p role="status" className="text-lg">
        {state.result === "approved"
          ? "Approved. todo-cat is logged in; head back to your terminal."
          : "Denied. todo-cat was not logged in."}
      </p>
    );
  }

  return (
    <Form action={formAction}>
      <input type="hidden" name="user_code" value={userCode} />
      <FormError message={state.error} />
      <div className="flex gap-3">
        <Button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
        >
          Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="deny"
          variant="secondary"
          disabled={pending}
        >
          Deny
        </Button>
      </div>
    </Form>
  );
}
