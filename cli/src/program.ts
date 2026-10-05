import {
  CreateTodoInput,
  type Todo,
  TodoListFilter,
  TodoStatus,
  UpdateTodoInput,
} from "@todo-cat/contract";
import { Command, CommanderError, Option } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { TodoApi, validate } from "./api";
import { login, logout, whoami } from "./auth";
import {
  CredentialStore,
  configDir,
  DEFAULT_SERVER,
  type Env,
  serverUrl,
} from "./config";
import { CliError, EXIT, notLoggedIn } from "./errors";
import { formatAccount, formatTodoLine, formatTodoList } from "./format";

/** Where the CLI reads its environment and writes its output; tests pass their own. */
export interface Io {
  env: Env;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const ROOT_HELP = `
Examples:
  $ todo-cat login
  $ todo-cat add "feed the cat" --due 2026-10-06
  $ todo-cat list --json
  $ todo-cat done 3f6c2a9e-8d1b-4c57-9e2f-0a4b6d8c1e73
  $ todo-cat delete 3f6c2a9e-8d1b-4c57-9e2f-0a4b6d8c1e73 --yes

Environment:
  TODO_CAT_URL         server URL (default: ${DEFAULT_SERVER})
  TODO_CAT_CONFIG_DIR  directory of credentials.json (default: ~/.config/todo-cat)

Exit codes (error code in brackets):
  0  success
  1  unexpected failure [server-unreachable, unexpected-response, unexpected-error]
  2  invalid usage or input [usage, validation-failed]
  3  not logged in, or login denied or expired [unauthorized, login-denied, login-expired]
  4  no such to-do [todo-not-found]

Errors go to stderr as "error [<code>]: <message>", with --json as
{"error":{"code":"<code>","message":"<message>"}}. todo-cat never prompts.`;

function examples(...lines: string[]): string {
  return `\nExamples:\n${lines.map((line) => `  $ todo-cat ${line}`).join("\n")}`;
}

/** Prints results on stdout and errors on stderr, as text or as JSON. */
class Output {
  constructor(
    private readonly io: Io,
    public json: boolean,
  ) {}

  result(data: unknown, text: string): void {
    this.io.stdout(`${this.json ? JSON.stringify(data, null, 2) : text}\n`);
  }

  /** Progress for humans (the login code); always text on stderr. */
  progress(line: string): void {
    this.io.stderr(`${line}\n`);
  }

  error(error: CliError): void {
    const { code, message } = error;
    this.io.stderr(
      this.json
        ? `${JSON.stringify({ error: { code, message } })}\n`
        : `error [${code}]: ${message}\n`,
    );
  }
}

/** Runs the CLI with the arguments after `todo-cat` and returns the exit code. */
export async function run(argv: string[], io: Io): Promise<number> {
  // Known before parsing, so that usage errors already come out as JSON.
  const end = argv.indexOf("--");
  const out = new Output(
    io,
    (end === -1 ? argv : argv.slice(0, end)).includes("--json"),
  );
  const program = createProgram(io, out);
  try {
    await program.parseAsync(argv, { from: "user" });
    return EXIT.ok;
  } catch (error) {
    if (error instanceof CommanderError) {
      // Help and version print and exit 0; `todo-cat` alone prints help to stderr.
      if (error.exitCode === 0) return EXIT.ok;
      if (error.code === "commander.help") return EXIT.usage;
      out.error(
        new CliError(
          "usage",
          `${error.message.replace(/^error: /, "").replace(/\s*\n\s*/g, " ")} (see --help)`,
        ),
      );
      return EXIT.usage;
    }
    if (error instanceof CliError) {
      out.error(error);
      return error.exitCode;
    }
    out.error(
      new CliError(
        "unexpected-error",
        error instanceof Error ? error.message : String(error),
      ),
    );
    return EXIT.failure;
  }
}

function createProgram(io: Io, out: Output): Command {
  const program = new Command("todo-cat")
    .description(
      "Keep your to-do list from the terminal. Lissie the cat is watching.",
    )
    .version(packageJson.version)
    .option(
      "--json",
      "print results as JSON on stdout, errors as JSON on stderr",
    )
    .configureHelp({ showGlobalOptions: true })
    .configureOutput({
      writeOut: io.stdout,
      writeErr: io.stderr,
      // run() prints usage errors itself, with their error code.
      outputError: () => {},
    })
    .exitOverride()
    .showSuggestionAfterError()
    .addHelpText("after", ROOT_HELP)
    .hook("preAction", () => {
      out.json = program.opts().json === true;
    });

  const server = () => serverUrl(io.env);
  const store = () => new CredentialStore(configDir(io.env));
  const api = async () => {
    const url = server();
    const token = await store().token(url);
    if (!token) throw notLoggedIn(url);
    return new TodoApi(url, token);
  };
  const todoResult = (todo: Todo) => out.result(todo, formatTodoLine(todo));

  program
    .command("login")
    .description("log in by approving a one-time code in a browser")
    .addHelpText(
      "after",
      `
The code and the URL go to stderr right away; then login waits (up to 30
minutes) until someone approves the code. Agents: run it in the background
and pass the code and URL on to your human.
${examples("login", "login --json")}`,
    )
    .action(async () => {
      const account = await login(server(), store(), (line) =>
        out.progress(line),
      );
      out.result(account, formatAccount(account));
    });

  program
    .command("logout")
    .description("revoke the session on the server and forget the token")
    .addHelpText("after", examples("logout"))
    .action(async () => {
      const url = server();
      const loggedOut = await logout(url, store());
      out.result(
        { server: url, loggedOut },
        loggedOut ? `Logged out of ${url}.` : `Not logged in to ${url}.`,
      );
    });

  program
    .command("whoami")
    .description("show the user you are logged in as")
    .addHelpText("after", examples("whoami", "whoami --json"))
    .action(async () => {
      const url = server();
      const account = await whoami(url, await store().token(url));
      out.result(account, formatAccount(account));
    });

  program
    .command("list")
    .alias("ls")
    .description("list your to-dos: open ones first, then by due date")
    .addOption(
      new Option("-s, --status <status>", "which to-dos to list")
        .choices(TodoStatus.options)
        .default("open"),
    )
    .option("--search <text>", "only titles containing the text (any case)")
    .addHelpText(
      "after",
      examples("list", "list --status all --search cat", "list --json"),
    )
    .action(async (options: { status: string; search?: string }) => {
      const filter = validate(TodoListFilter, options);
      const todos = await (await api()).list(filter);
      out.result(todos, formatTodoList(todos, filter));
    });

  program
    .command("show")
    .description("show one to-do")
    .argument("<id>", "the to-do's id")
    .addHelpText("after", examples("show <id> --json"))
    .action(async (id: string) => todoResult(await (await api()).get(id)));

  program
    .command("add")
    .description("add a to-do")
    .argument("<title...>", "the title; several words are joined by spaces")
    .option("-d, --due <date>", "due date as yyyy-mm-dd")
    .addHelpText(
      "after",
      examples(
        'add "feed the cat"',
        "add clean the litter box --due 2026-10-06",
        'add "vet appointment" --json',
      ),
    )
    .action(async (words: string[], options: { due?: string }) => {
      const input = validate(CreateTodoInput, {
        title: words.join(" "),
        dueDate: options.due,
      });
      todoResult(await (await api()).add(input));
    });

  program
    .command("done")
    .description("mark a to-do as done")
    .argument("<id>", "the to-do's id")
    .addHelpText("after", examples("done <id>"))
    .action(async (id: string) =>
      todoResult(await (await api()).update(id, { done: true })),
    );

  program
    .command("reopen")
    .description("mark a done to-do as open again")
    .argument("<id>", "the to-do's id")
    .addHelpText("after", examples("reopen <id>"))
    .action(async (id: string) =>
      todoResult(await (await api()).update(id, { done: false })),
    );

  program
    .command("edit")
    .description("change a to-do's title or due date")
    .argument("<id>", "the to-do's id")
    .option("-t, --title <title>", "the new title")
    .option("-d, --due <date>", "the new due date as yyyy-mm-dd")
    .option("--no-due", "remove the due date")
    .addHelpText(
      "after",
      examples(
        'edit <id> --title "feed the cat twice"',
        "edit <id> --due 2026-10-07",
        "edit <id> --no-due",
      ),
    )
    .action(
      async (id: string, options: { title?: string; due?: string | false }) => {
        // Only the options given, so that no options is an empty patch.
        const patch = validate(UpdateTodoInput, {
          ...(options.title !== undefined && { title: options.title }),
          ...(options.due !== undefined && {
            dueDate: options.due === false ? null : options.due,
          }),
        });
        todoResult(await (await api()).update(id, patch));
      },
    );

  program
    .command("delete")
    .alias("rm")
    .description("delete a to-do for good; needs --yes")
    .argument("<id>", "the to-do's id")
    .option("-y, --yes", "confirm the deletion (todo-cat never prompts)")
    .addHelpText("after", examples("delete <id> --yes"))
    .action(async (id: string, options: { yes?: boolean }) => {
      if (!options.yes) {
        throw new CliError(
          "usage",
          "Deleting cannot be undone; add --yes to confirm.",
        );
      }
      await (await api()).delete(id);
      out.result({ id, deleted: true }, `Deleted ${id}.`);
    });

  return program;
}
