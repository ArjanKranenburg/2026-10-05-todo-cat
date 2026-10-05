import { UpdateTodoInput } from "@todo-cat/contract";
import { handle, parseBody } from "@/lib/rest";
import { deleteTodo, getTodo, updateTodo } from "@/lib/todo-service";

// REST adapter for the todo service (tech-docs/rest-api.md).

type Context = RouteContext<"/api/todos/[id]">;

export function GET(request: Request, ctx: Context) {
  return handle(request, async (userId) => {
    const { id } = await ctx.params;
    return Response.json(await getTodo(userId, id));
  });
}

export function PATCH(request: Request, ctx: Context) {
  return handle(request, async (userId) => {
    const { id } = await ctx.params;
    const patch = await parseBody(UpdateTodoInput, request);
    return Response.json(await updateTodo(userId, id, patch));
  });
}

export function DELETE(request: Request, ctx: Context) {
  return handle(request, async (userId) => {
    const { id } = await ctx.params;
    await deleteTodo(userId, id);
    return new Response(null, { status: 204 });
  });
}
