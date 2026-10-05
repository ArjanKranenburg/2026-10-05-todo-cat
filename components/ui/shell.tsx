import type { ReactNode } from "react";

// The single narrow column every page sits in.
export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      {children}
    </main>
  );
}
