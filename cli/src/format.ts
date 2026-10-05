export interface TodoLine {
  title: string;
  done: boolean;
}

/** Renders one to-do as a checklist line, e.g. `[x] feed the cat`. */
export function formatTodoLine({ title, done }: TodoLine): string {
  return `[${done ? "x" : " "}] ${title}`;
}
