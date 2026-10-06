import "server-only";
import {
  MASTRA_RESOURCE_ID_KEY,
  type RequestContext,
} from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import type { ErrorBody } from "@todo-cat/contract";
import {
  LISSIE_TOOL_INPUTS,
  ListTodosOutput,
  TodoOutput,
} from "./lissie-tool-calls";
import { addTodo, listTodos, TodoError, updateTodo } from "./todo-service";

// Lissie's paws on the list: one more adapter on the todo service
// (tech-docs/architecture.md). Mastra parses the input with the contract
// schemas before `execute` runs. The owner is never an argument: the chat
// runtime puts the signed-in user's id into the request context as
// MASTRA_RESOURCE_ID_KEY (lib/chat-runtime.ts), so the model can only ever
// reach its own user's list.

/** The signed-in user the runtime put into the request context. */
function ownerOf(requestContext: RequestContext | undefined): string {
  const userId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
  // A bug in the runtime, not something the model can cause or fix.
  if (typeof userId !== "string" || userId === "") {
    throw new Error("Lissie's tools ran without a signed-in user");
  }
  return userId;
}

/**
 * Service errors become the tool's result, so the model can tell the user
 * (and the chat can show it); a thrown error would leave the call unanswered.
 */
async function mapErrors<T>(run: () => Promise<T>): Promise<T | ErrorBody> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof TodoError) {
      return { error: { code: error.code, message: error.message } };
    }
    throw error;
  }
}

export const listTodosTool = createTool({
  id: "listTodos",
  description:
    "Lists your human's to-dos, open ones first. Filter by status (open, done or all, the default) and by text in the title. Use it before answering anything about the list, and to find a to-do's id.",
  inputSchema: LISSIE_TOOL_INPUTS.listTodos,
  outputSchema: ListTodosOutput,
  execute: async (filter, { requestContext }) => {
    const userId = ownerOf(requestContext);
    return mapErrors(async () => ({ todos: await listTodos(userId, filter) }));
  },
});

export const addTodoTool = createTool({
  id: "addTodo",
  description:
    "Adds a to-do to your human's list, with an optional due date (yyyy-mm-dd). Returns the new to-do.",
  inputSchema: LISSIE_TOOL_INPUTS.addTodo,
  outputSchema: TodoOutput,
  execute: async (input, { requestContext }) => {
    const userId = ownerOf(requestContext);
    return mapErrors(() => addTodo(userId, input));
  },
});

export const setTodoDoneTool = createTool({
  id: "setTodoDone",
  description:
    "Marks one of your human's to-dos done (done: true) or reopens it (done: false), by its id from listTodos. Returns the changed to-do.",
  inputSchema: LISSIE_TOOL_INPUTS.setTodoDone,
  outputSchema: TodoOutput,
  execute: async ({ id, done }, { requestContext }) => {
    const userId = ownerOf(requestContext);
    return mapErrors(() => updateTodo(userId, id, { done }));
  },
});

/** Keyed by tool id, which is the name the model and the chat see. */
export const lissieTools = {
  listTodos: listTodosTool,
  addTodo: addTodoTool,
  setTodoDone: setTodoDoneTool,
};
