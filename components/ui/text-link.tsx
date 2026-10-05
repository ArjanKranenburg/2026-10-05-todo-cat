import Link from "next/link";
import type { ComponentProps } from "react";

export function TextLink(
  props: Omit<ComponentProps<typeof Link>, "className">,
) {
  return (
    <Link
      className="font-medium underline decoration-line underline-offset-4 outline-accent hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
      {...props}
    />
  );
}
