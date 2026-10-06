import "server-only";
import type { MastraModelConfig } from "@mastra/core/llm";

// Lissie's model through Mastra's model router, which reads OPENROUTER_API_KEY
// from the server environment. A module of its own so tests can swap in a mock.
export const lissieModel: MastraModelConfig = `openrouter/${
  process.env.OPENROUTER_MODEL || "z-ai/glm-5.3-flash"
}`;
