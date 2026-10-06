import type { A2uiMessage } from "@a2ui/web_core/v0_9";
import type { Todo } from "@todo-cat/contract";
import { LISSIE_CATALOG_ID } from "./lissie-catalog";

// The progress card of Lissie's showProgress tool (lib/lissie-tools.ts) as
// A2UI operations, which the runtime's A2UI middleware turns into a card in
// the chat. The component tree is fixed and written once, here; the numbers
// reach it only through the surface's data model, so the model never writes
// them and no second model call builds the card.

/** How far along a list is. */
export interface ListProgress {
  total: number;
  done: number;
  open: number;
}

export function progressOf(todos: Pick<Todo, "done">[]): ListProgress {
  const done = todos.filter((todo) => todo.done).length;
  return { total: todos.length, done, open: todos.length - done };
}

/** A2UI interpolation: the value at a data model path, inside a string. */
const at = (path: `/${keyof ListProgress}`) => `\${${path}}`;

/**
 * The card's components (lib/lissie-catalog.ts lists the catalog), bound to a
 * data model that is a `ListProgress`. A2UI renders from the "root" component.
 */
export const PROGRESS_CARD = [
  { id: "root", component: "Card", child: "body" },
  { id: "body", component: "Column", children: ["bar", "counts"] },
  {
    id: "bar",
    component: "ProgressBar",
    label: "Done",
    value: { path: "/done" },
    max: { path: "/total" },
  },
  {
    id: "counts",
    component: "Text",
    text: {
      call: "formatString",
      args: {
        value: `${at("/done")} of ${at("/total")} done, ${at("/open")} open`,
      },
      returnType: "string",
    },
  },
];

/** A tool result the A2UI middleware renders: the key is its contract. */
export interface A2uiOperations {
  a2ui_operations: A2uiMessage[];
}

/** The operations that paint the progress card on a new surface. */
export function progressCard(
  surfaceId: string,
  progress: ListProgress,
): A2uiOperations {
  return {
    a2ui_operations: [
      {
        version: "v0.9",
        createSurface: { surfaceId, catalogId: LISSIE_CATALOG_ID },
      },
      {
        version: "v0.9",
        updateComponents: { surfaceId, components: PROGRESS_CARD },
      },
      {
        version: "v0.9",
        updateDataModel: { surfaceId, path: "/", value: progress },
      },
    ],
  };
}
