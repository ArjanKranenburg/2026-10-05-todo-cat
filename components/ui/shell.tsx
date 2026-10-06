import type { ReactNode } from "react";

const widths = {
  // Forms and short pages, centered in the viewport.
  narrow: "max-w-sm justify-center py-16",
  // The chat: wider, exactly one viewport tall, so the chat scrolls instead of the page.
  wide: "h-dvh max-w-2xl py-8",
};

// The single column every page sits in.
export function Shell({
  children,
  width = "narrow",
}: {
  children: ReactNode;
  width?: keyof typeof widths;
}) {
  return (
    <main
      className={`mx-auto flex w-full flex-1 flex-col gap-8 px-4 ${widths[width]}`}
    >
      {children}
    </main>
  );
}
