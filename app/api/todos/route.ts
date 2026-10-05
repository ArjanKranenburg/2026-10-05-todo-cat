import { CreateTodoInput, TodoListFilter } from "@todo-cat/contract";
import { handle, parseBody, parseQuery } from "@/lib/rest";
import { addTodo, listTodos } from "@/lib/todo-service";

// REST adapter for the todo service (tech-docs/rest-api.md).

export function GET(request: Request) {
  return handle(request, async (userId) => {
    const filter = parseQuery(TodoListFilter, request);
    return Response.json(await listTodos(userId, filter));
  });
}

export function POST(request: Request) {
  return handle(request, async (userId) => {
    const todo = await addTodo(
      userId,
      await parseBody(CreateTodoInput, request),
    );
    return Response.json(todo, {
      status: 201,
      headers: { location: `/api/todos/${todo.id}` },
    });
  });
}
