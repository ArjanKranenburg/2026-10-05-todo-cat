import type { ErrorCode } from "@todo-cat/contract";

/** Exit codes, documented in `todo-cat --help` and tech-docs/cli.md. */
export const EXIT = {
  ok: 0,
  failure: 1,
  usage: 2,
  unauthorized: 3,
  notFound: 4,
} as const;

/**
 * Every code the CLI prints: the API's error codes plus the CLI's own. Callers
 * switch on the code, never the message.
 */
export type CliErrorCode =
  | ErrorCode
  | "usage"
  | "login-denied"
  | "login-expired"
  | "server-unreachable"
  | "unexpected-response"
  | "unexpected-error";

const EXIT_CODE: Record<CliErrorCode, number> = {
  "validation-failed": EXIT.usage,
  usage: EXIT.usage,
  unauthorized: EXIT.unauthorized,
  "login-denied": EXIT.unauthorized,
  "login-expired": EXIT.unauthorized,
  "todo-not-found": EXIT.notFound,
  "server-unreachable": EXIT.failure,
  "unexpected-response": EXIT.failure,
  "unexpected-error": EXIT.failure,
};

/** An expected failure: printed to stderr with its code, then the CLI exits. */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(
    readonly code: CliErrorCode,
    message: string,
  ) {
    super(message);
    this.exitCode = EXIT_CODE[code];
  }
}

export function notLoggedIn(server: string): CliError {
  return new CliError(
    "unauthorized",
    `Not logged in to ${server}. Run \`todo-cat login\` first.`,
  );
}

/** Turns a failed `fetch` (refused connection, DNS, timeout) into a CliError. */
export function unreachable(server: string, error: unknown): CliError {
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause
      : error;
  const reason =
    cause instanceof Error && cause.name === "TimeoutError"
      ? "no answer in time"
      : ((cause as { code?: string } | null)?.code ?? String(cause));
  return new CliError(
    "server-unreachable",
    `Cannot reach the todo-cat server at ${server} (${reason}). Is it running? TODO_CAT_URL picks another server.`,
  );
}
