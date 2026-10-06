import { chatHandler } from "@/lib/chat-runtime";

// The CopilotKit runtime serving Lissie over AG-UI; every route it serves is
// authorized in lib/chat-runtime.ts (tech-docs/agent.md).

export {
  chatHandler as DELETE,
  chatHandler as GET,
  chatHandler as PATCH,
  chatHandler as POST,
};
