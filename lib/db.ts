import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { authRelations } from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

// The app's only database client; everything else imports `db` from here. It
// pools several SQLite connections, and so does any script or test on the same
// file: wait up to 5 s for another one's write lock instead of failing at once.
export const db = drizzle({
  connection: { url, timeout: 5_000 },
  relations: authRelations,
});
