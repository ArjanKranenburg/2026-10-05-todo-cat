import type { ReactNode } from "react";

const widths = {
  // Forms and short pages, centered in the viewport.
  narrow: "flex-1 max-w-sm justify-center py-16",
  // The chat and its sidebar: wider, exactly one viewport tall, so the chat
  // scrolls instead of the page. No flex-1: as a grown flex item it would grow
  // with its content.
  wide: "h-dvh max-w-5xl py-8",
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
      className={`mx-auto flex w-full flex-col gap-8 px-4 ${widths[width]}`}
    >
      {children}
    </main>
  );
}
