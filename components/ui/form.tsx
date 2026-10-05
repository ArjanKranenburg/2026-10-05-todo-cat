import type { ComponentProps } from "react";

// A vertical stack of fields; pass `action` like on a plain <form>.
export function Form(props: Omit<ComponentProps<"form">, "className">) {
  return <form className="flex flex-col gap-5" {...props} />;
}

// Renders nothing until there is a message, so screen readers announce it on arrival.
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm font-medium text-danger">
      {message}
    </p>
  );
}
