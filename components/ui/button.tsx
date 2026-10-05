import type { ComponentProps } from "react";

const base =
  "inline-flex h-11 items-center justify-center rounded-lg px-5 font-medium outline-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60";

const variants = {
  primary: "bg-foreground text-background hover:bg-foreground/85",
  secondary: "border border-line hover:border-foreground",
};

type ButtonProps = Omit<ComponentProps<"button">, "className"> & {
  variant?: keyof typeof variants;
};

export function Button({ variant = "primary", ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]}`} {...props} />;
}
