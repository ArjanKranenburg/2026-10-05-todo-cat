import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CredentialStore, configDir, serverUrl } from "./config";

describe("serverUrl", () => {
  test("defaults to localhost:3000", () => {
    expect(serverUrl({})).toBe("http://localhost:3000");
  });

  test("takes TODO_CAT_URL without its trailing slash", () => {
    expect(serverUrl({ TODO_CAT_URL: "https://todo.example/app/" })).toBe(
      "https://todo.example/app",
    );
  });

  test.each(["localhost:3000", "ftp://todo.example"])(
    "rejects %s as a usage error",
    (url) => {
      expect(() => serverUrl({ TODO_CAT_URL: url })).toThrow(
        expect.objectContaining({ code: "usage", exitCode: 2 }),
      );
    },
  );
});

describe("configDir", () => {
  test("prefers TODO_CAT_CONFIG_DIR", () => {
    expect(configDir({ TODO_CAT_CONFIG_DIR: "/tmp/cat" })).toBe("/tmp/cat");
  });

  test.skipIf(process.platform === "win32")(
    "uses XDG_CONFIG_HOME on Unix",
    () => {
      expect(configDir({ XDG_CONFIG_HOME: "/home/lissie/.cfg" })).toBe(
        "/home/lissie/.cfg/todo-cat",
      );
    },
  );
});

describe("CredentialStore", () => {
  let dir: string;
  let store: CredentialStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "todo-cat-config-test-"));
    store = new CredentialStore(join(dir, "todo-cat"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("keeps one token per server", async () => {
    await store.save("http://localhost:3000", "local-token");
    await store.save("https://todo.example", "remote-token");

    expect(await store.token("http://localhost:3000")).toBe("local-token");
    expect(await store.token("https://todo.example")).toBe("remote-token");
    expect(await store.token("http://localhost:4000")).toBeUndefined();
  });

  test.skipIf(process.platform === "win32")(
    "writes the file and its directory for the owner only",
    async () => {
      await store.save("http://localhost:3000", "token");

      expect(statSync(store.file).mode & 0o777).toBe(0o600);
      expect(statSync(store.dir).mode & 0o777).toBe(0o700);
    },
  );

  test("removing the last token deletes the file", async () => {
    await store.save("http://localhost:3000", "local-token");
    await store.save("https://todo.example", "remote-token");

    await store.remove("http://localhost:3000");
    expect(await store.token("http://localhost:3000")).toBeUndefined();
    expect(await store.token("https://todo.example")).toBe("remote-token");

    await store.remove("https://todo.example");
    expect(() => statSync(store.file)).toThrow();
  });

  test("names the file when it is damaged", async () => {
    await store.save("http://localhost:3000", "token");
    writeFileSync(store.file, "{ not json");

    await expect(store.token("http://localhost:3000")).rejects.toThrow(
      store.file,
    );
  });
});
