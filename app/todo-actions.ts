"use server";
import { CreateTodoInput, UpdateTodoInput } from "@todo-cat/contract";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { addTodo, deleteTodo, updateTodo } from "@/lib/todo-service";

// Browser adapter for the todo service; same rules as all other adapters
// (tech-docs/architecture.md): validate input, resolve user, call service, map errors.

export async function addTodoAction(formData: FormData) {
  const userId = await getUserId(await headers());
  if (!userId) return;
  const result = CreateTodoInput.safeParse({
    title: formData.get("title"),
    dueDate: (formData.get("dueDate") as string) || undefined,
  });
  if (!result.success) return;
  await addTodo(userId, result.data);
  revalidatePath("/");
}

export async function toggleTodoAction(id: string, done: boolean) {
  const userId = await getUserId(await headers());
  if (!userId) return;
  const result = UpdateTodoInput.safeParse({ done });
  if (!result.success) return;
  await updateTodo(userId, id, result.data);
  revalidatePath("/");
}

export async function deleteTodoAction(id: string) {
  const userId = await getUserId(await headers());
  if (!userId) return;
  await deleteTodo(userId, id);
  revalidatePath("/");
}
