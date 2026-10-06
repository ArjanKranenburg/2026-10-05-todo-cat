import {
  CardApi,
  DynamicNumberSchema,
  DynamicStringSchema,
} from "@a2ui/web_core/v0_9";
import type { CatalogDefinitions } from "@copilotkit/a2ui-renderer";
import { z } from "zod3";

// The A2UI catalog Lissie's cards render with (tech-docs/agent.md): the basic
// catalog plus the components defined here. Only their contracts live in this
// module, so the server and its tests can check a card against them; the React
// renderers are in components/chat/lissie-catalog.tsx.
// The schemas are zod 3 on purpose: A2UI reads them through zod 3 internals to
// decide which props to resolve from the data model, and its types are zod 3's.

/** Names the catalog in `createSurface`; the chat registers it under this id. */
export const LISSIE_CATALOG_ID = "todo-cat://lissie-catalog";

export const lissieCatalogDefinitions = {
  // Same contract as the basic Card, which paints a white box in dark mode.
  Card: { description: CardApi.schema.description, props: CardApi.schema },
  ProgressBar: {
    description:
      "A horizontal bar showing how much of a whole is done, with a short label.",
    props: z
      .object({
        value: DynamicNumberSchema.describe("How much is done."),
        max: DynamicNumberSchema.describe("The whole; 0 shows an empty bar."),
        label: DynamicStringSchema.describe("What the bar measures."),
      })
      .strict(),
  },
} satisfies CatalogDefinitions;
