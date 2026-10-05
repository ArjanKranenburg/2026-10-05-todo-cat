import { formatUserCode } from "@todo-cat/contract";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DeviceApproval } from "@/components/device/device-approval";
import { Button } from "@/components/ui/button";
import { Form, FormError } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Shell } from "@/components/ui/shell";
import { TextField } from "@/components/ui/text-field";
import { checkDeviceCode } from "@/lib/device";
import { getUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Log in todo-cat" };

// The verification page of `todo-cat login` (the device flow's verification_uri).
// Asks for the code unless the CLI's link carries it, then asks to approve it.
export default async function DevicePage({
  searchParams,
}: PageProps<"/device">) {
  const param = (await searchParams).user_code;
  const userCode = typeof param === "string" ? param.trim() : "";
  const here = userCode
    ? `/device?user_code=${encodeURIComponent(userCode)}`
    : "/device";
  const requestHeaders = await headers();
  if (!(await getUserId(requestHeaders))) {
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }

  const check = userCode
    ? await checkDeviceCode(requestHeaders, userCode)
    : null;

  if (check?.status === "pending") {
    return (
      <Shell>
        <PageHeader title="Let todo-cat in?">
          {`Approving lets ${check.client} manage your to-dos as you. Only approve if you just ran todo-cat login yourself and it shows this code:`}
        </PageHeader>
        <p className="font-mono text-3xl font-semibold tracking-widest">
          {formatUserCode(userCode)}
        </p>
        <DeviceApproval userCode={userCode} />
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader title="Log in todo-cat">
        Enter the code that todo-cat login shows in your terminal.
      </PageHeader>
      <FormError
        message={
          check &&
          (check.status === "invalid"
            ? check.message
            : "This code was already used. Run todo-cat login again for a new one.")
        }
      />
      <Form action="/device">
        <TextField
          label="Code"
          name="user_code"
          defaultValue={userCode}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-EFGH"
          required
        />
        <Button type="submit">Continue</Button>
      </Form>
    </Shell>
  );
}
