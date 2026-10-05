/**
 * The client id of the todo-cat CLI in Better Auth's device authorization flow;
 * the server accepts no other.
 */
export const CLI_CLIENT_ID = "todo-cat-cli";

/**
 * A device-flow user code as the CLI and the approval page show it: the
 * default 8 characters as `ABCD-EFGH`. Better Auth ignores the dash and case.
 */
export function formatUserCode(code: string): string {
  const plain = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return plain.length === 8 ? `${plain.slice(0, 4)}-${plain.slice(4)}` : code;
}
