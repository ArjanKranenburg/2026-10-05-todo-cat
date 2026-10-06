import {
  A2UIProvider,
  A2UIRenderer,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";
import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, test } from "vitest";
import { progressCard } from "@/lib/lissie-progress";
import { lissieCatalog } from "./lissie-catalog";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  test("shows how much of the whole is done", () => {
    render(<ProgressBar value={1} max={4} label="Done" />);

    const bar = screen.getByRole("progressbar", { name: "Done" });
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("4");
    expect(bar.getAttribute("aria-valuetext")).toBe("1 of 4");
    expect(screen.getByText("25%")).toBeDefined();
  });

  test("clamps values outside the whole, and shows an empty whole as 0%", () => {
    const { rerender } = render(<ProgressBar value={7} max={4} label="Done" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "4",
    );
    expect(screen.getByText("100%")).toBeDefined();

    rerender(<ProgressBar value={0} max={0} label="Done" />);
    expect(screen.getByText("0%")).toBeDefined();
  });
});

/** Paints the operations a tool returned, as the chat's A2UI renderer does. */
function Surface({ operations }: { operations: Record<string, unknown>[] }) {
  const { processMessages } = useA2UIActions();
  useEffect(() => processMessages(operations), [processMessages, operations]);
  return <A2UIRenderer surfaceId="progress-test" />;
}

test("Lissie's catalog renders the progress card with its numbers bound from the data model", async () => {
  const { a2ui_operations } = progressCard("progress-test", {
    total: 3,
    done: 1,
    open: 2,
  });

  render(
    <A2UIProvider catalog={lissieCatalog}>
      <Surface
        operations={a2ui_operations.map((operation) => ({ ...operation }))}
      />
    </A2UIProvider>,
  );

  const bar = await screen.findByRole("progressbar", { name: "Done" });
  expect(bar.getAttribute("aria-valuenow")).toBe("1");
  expect(bar.getAttribute("aria-valuemax")).toBe("3");
  expect(await screen.findByText("1 of 3 done, 2 open")).toBeDefined();
});
