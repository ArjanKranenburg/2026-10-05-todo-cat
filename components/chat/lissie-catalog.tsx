import {
  type CatalogRenderers,
  createCatalog,
} from "@copilotkit/a2ui-renderer";
import {
  LISSIE_CATALOG_ID,
  lissieCatalogDefinitions,
} from "@/lib/lissie-catalog";
import { ProgressBar } from "./progress-bar";

// A2UI resolves data-model bindings before a renderer runs, so a bound prop
// arrives as its value; the types still allow the binding itself.
const numberOf = (value: unknown) => (typeof value === "number" ? value : 0);
const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const renderers: CatalogRenderers<typeof lissieCatalogDefinitions> = {
  Card: ({ props, children }) => (
    <div className="my-2 w-full max-w-sm rounded-lg border border-(--chat-line) bg-(--chat-surface) p-2 text-(--chat-ink)">
      {children(props.child)}
    </div>
  ),
  ProgressBar: ({ props }) => (
    <ProgressBar
      value={numberOf(props.value)}
      max={numberOf(props.max)}
      label={textOf(props.label)}
    />
  ),
};

/**
 * The A2UI components the chat renders Lissie's cards with: the basic catalog,
 * whose Card these renderers replace, plus ProgressBar (lib/lissie-catalog.ts).
 */
export const lissieCatalog = createCatalog(
  lissieCatalogDefinitions,
  renderers,
  { catalogId: LISSIE_CATALOG_ID, includeBasicCatalog: true },
);
