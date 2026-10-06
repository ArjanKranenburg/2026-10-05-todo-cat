import type { Client } from "@libsql/client";
import { MastraCompositeStore } from "@mastra/core/storage";
import { MemoryLibSQL } from "@mastra/libsql";

/**
 * Mastra's storage on a libsql client: only the memory domain (threads,
 * messages, resources), so Mastra adds its `mastra_*` memory tables to our
 * SQLite file and nothing else. The app passes `lib/db.ts`'s client with
 * `disableInit`; `npm run db:migrate` creates the tables (scripts/mastra-migrate.mts).
 */
export function mastraStorage(
  client: Client,
  { disableInit }: { disableInit: boolean },
) {
  return new MastraCompositeStore({
    id: "todo-cat",
    domains: { memory: new MemoryLibSQL({ client }) },
    disableInit,
  });
}
