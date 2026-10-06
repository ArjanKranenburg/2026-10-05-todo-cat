"use client";

import "@copilotkit/react-core/v2/styles.css";
import {
  CopilotChat,
  type CopilotKitMessageFilter,
  CopilotKitProvider,
} from "@copilotkit/react-core/v2";
import { useSyncExternalStore } from "react";
import { lissieCatalog } from "./lissie-catalog";
import { LissieToolCalls } from "./lissie-tool-calls";

// The A2UI components Lissie's cards use. The schema stays out of the run's
// context: she never generates UI, her tools return finished cards.
const a2ui = { catalog: lissieCatalog, includeSchema: false };

// Lissie's memory already holds the conversation, so a run sends only the
// newest message; CopilotKit still renders the whole thread.
const newestOnly: CopilotKitMessageFilter = (messages) => messages.slice(-1);

const darkQuery = "(prefers-color-scheme: dark)";

function subscribeToColorScheme(onChange: () => void) {
  const query = window.matchMedia(darkQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// CopilotKit's components switch to their dark styles under a `.dark`
// ancestor, while the app follows the OS setting (app/globals.css).
function usePrefersDark(): boolean {
  return useSyncExternalStore(
    subscribeToColorScheme,
    () => window.matchMedia(darkQuery).matches,
    () => false,
  );
}

/**
 * The chat with Lissie over the CopilotKit runtime at /api/copilotkit.
 * `threadId` is the user's current conversation (`currentLissieThread`); the
 * runtime rejects other users' threads, and replays this one's history from
 * Lissie's memory, tool calls included.
 * `inspector` shows the CopilotKit Inspector, which CopilotKit itself limits
 * to development builds on localhost.
 */
export function LissieChat({
  threadId,
  inspector,
}: {
  threadId: string;
  inspector: boolean;
}) {
  const dark = usePrefersDark();
  return (
    <div
      className={`lissie-chat flex min-h-0 min-w-0 flex-1 flex-col ${dark ? "dark" : ""}`}
    >
      <CopilotKitProvider
        runtimeUrl="/api/copilotkit"
        agentId="lissie"
        useSingleEndpoint={false}
        enableInspector={inspector}
        messageFilter={newestOnly}
        a2ui={a2ui}
      >
        <LissieToolCalls />
        <CopilotChat
          threadId={threadId}
          className="min-h-0 flex-1"
          labels={{
            chatInputPlaceholder: "Tell Lissie what needs doing…",
            chatDisclaimerText:
              "Lissie is a cat. She can be wrong, and she will not apologise.",
          }}
        />
      </CopilotKitProvider>
    </div>
  );
}
