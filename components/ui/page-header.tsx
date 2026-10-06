import type { ReactNode } from "react";

export function PageHeader({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance">
        {title}
      </h1>
      {children && <p className="text-lg leading-7 text-muted">{children}</p>}
    </header>
  );
}
