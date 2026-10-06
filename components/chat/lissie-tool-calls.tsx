"use client";

import { useAgent, useRenderTool } from "@copilotkit/react-core/v2";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  describeToolCall,
  LISSIE_TOOL_INPUTS,
  LISSIE_WRITE_TOOLS,
  type LissieToolName,
  type ToolCallLine,
} from "@/lib/lissie-tool-calls";

const marks: Record<ToolCallLine["outcome"], string> = {
  running: "…",
  done: "✓",
  failed: "✕",
};

// Inside the chat, CopilotKit redefines --muted as a surface colour, so text
// takes the chat's own aliases (app/globals.css), not text-muted.
const colors: Record<ToolCallLine["outcome"], string> = {
  running: "text-(--chat-quiet)",
  done: "text-(--chat-quiet)",
  failed: "text-(--chat-danger)",
};

function ToolCallLineView({ text, outcome }: ToolCallLine) {
  return (
    <p
      data-testid="lissie-tool-call"
      data-outcome={outcome}
      className={`my-1 flex gap-2 text-sm leading-6 ${colors[outcome]}`}
    >
      <span aria-hidden="true" className="w-3 shrink-0 text-center">
        {marks[outcome]}
      </span>
      <span>{text}</span>
    </p>
  );
}

function useToolCallLine(name: LissieToolName) {
  useRenderTool(
    {
      name,
      parameters: LISSIE_TOOL_INPUTS[name],
      render: ({ parameters, result }) => (
        <ToolCallLineView {...describeToolCall(name, parameters, result)} />
      ),
    },
    [name],
  );
}

/**
 * Shows each of Lissie's tool calls as one readable line in the chat, live
 * and in replayed history, and reloads the page's server data (the to-do
 * sidebar) whenever one of her calls has changed the list. Renders nothing
 * itself; it must sit inside the CopilotKitProvider.
 */
export function LissieToolCalls() {
  useToolCallLine("listTodos");
  useToolCallLine("addTodo");
  useToolCallLine("setTodoDone");

  const router = useRouter();
  // No re-renders: this only listens to the run's events.
  const { agent } = useAgent({ updates: [] });
  useEffect(() => {
    // A replayed history arrives as a snapshot, not as these events.
    const names = new Map<string, string>();
    const { unsubscribe } = agent.subscribe({
      onToolCallStartEvent: ({ event }) => {
        names.set(event.toolCallId, event.toolCallName);
      },
      onToolCallResultEvent: ({ event }) => {
        if (LISSIE_WRITE_TOOLS.has(names.get(event.toolCallId) ?? "")) {
          router.refresh();
        }
      },
    });
    return unsubscribe;
  }, [agent, router]);

  return null;
}
