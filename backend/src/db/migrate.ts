import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, sql } from "./client.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await migrate(db, { migrationsFolder: path.join(here, "migrations") });
  console.log("migrations applied");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
