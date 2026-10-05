import type { ComponentProps } from "react";

type TextFieldProps = Omit<ComponentProps<"input">, "id" | "className"> & {
  label: string;
  name: string;
};

// A labelled input; `name` doubles as the id the label points at.
export function TextField({ label, name, ...props }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="h-11 w-full rounded-lg border border-line bg-background px-3 text-base outline-accent transition-colors focus-visible:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
        {...props}
      />
    </div>
  );
}
