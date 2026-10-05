import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { CliError } from "./errors";

export const DEFAULT_SERVER = "http://localhost:3000";

/** Environment variables; `process.env` in the bin, a plain object in tests. */
export type Env = Record<string, string | undefined>;

/** The server base URL: TODO_CAT_URL or http://localhost:3000, without a trailing slash. */
export function serverUrl(env: Env = process.env): string {
  const raw = env.TODO_CAT_URL || DEFAULT_SERVER;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CliError("usage", `TODO_CAT_URL is not a URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CliError("usage", `TODO_CAT_URL must be http or https: ${raw}`);
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

/**
 * Where the credentials file lives: TODO_CAT_CONFIG_DIR, else the user's config
 * directory (XDG_CONFIG_HOME or ~/.config, %APPDATA% on Windows) plus `todo-cat`.
 */
export function configDir(env: Env = process.env): string {
  if (env.TODO_CAT_CONFIG_DIR) return env.TODO_CAT_CONFIG_DIR;
  const base =
    process.platform === "win32"
      ? (env.APPDATA ?? join(homedir(), "AppData", "Roaming"))
      : (env.XDG_CONFIG_HOME ?? join(homedir(), ".config"));
  return join(base, "todo-cat");
}

// One session token per server, so a token is only ever sent to the server
// that issued it, even after TODO_CAT_URL changes.
const Credentials = z.object({
  servers: z.record(z.string(), z.object({ token: z.string() })),
});
type Credentials = z.infer<typeof Credentials>;

/** The session tokens in `<config dir>/credentials.json`, readable by the owner only. */
export class CredentialStore {
  readonly file: string;

  constructor(readonly dir: string) {
    this.file = join(dir, "credentials.json");
  }

  async token(server: string): Promise<string | undefined> {
    return (await this.read()).servers[server]?.token;
  }

  async save(server: string, token: string): Promise<void> {
    const credentials = await this.read();
    credentials.servers[server] = { token };
    await this.write(credentials);
  }

  async remove(server: string): Promise<void> {
    const credentials = await this.read();
    delete credentials.servers[server];
    if (Object.keys(credentials.servers).length === 0) {
      await rm(this.file, { force: true });
    } else {
      await this.write(credentials);
    }
  }

  private async read(): Promise<Credentials> {
    let text: string;
    try {
      text = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { servers: {} };
      }
      throw error;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
    const parsed = Credentials.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `${this.file} is damaged; delete it and run \`todo-cat login\` again.`,
      );
    }
    return parsed.data;
  }

  // Writes a fresh owner-only file and renames it over the old one, so the
  // token is never readable by others, not even for a moment.
  private async write(credentials: Credentials): Promise<void> {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const temp = `${this.file}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(credentials, null, 2)}\n`, {
      mode: 0o600,
    });
    await chmod(temp, 0o600);
    await rename(temp, this.file);
  }
}
