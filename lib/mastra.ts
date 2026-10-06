import "server-only";
import { Mastra } from "@mastra/core";
import { db } from "./db";
import { lissie } from "./lissie";
import { mastraStorage } from "./mastra-storage";

// The app's Mastra instance. Its memory lives in our SQLite file, on the same
// connection as everything else; `npm run db:migrate` creates its tables.
export const mastra = new Mastra({
  agents: { lissie },
  storage: mastraStorage(db.$client, { disableInit: true }),
});
