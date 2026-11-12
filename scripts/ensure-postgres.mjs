import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = ".data/pg";
const pg = new EmbeddedPostgres({
  databaseDir,
  user: "beatledger",
  password: "beatledger",
  port: 54329,
  persistent: true,
  autoRehydrateSymlinks: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (!existsSync(`${databaseDir}/PG_VERSION`)) {
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase("beatledger");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/already exists/i.test(message)) throw error;
}

console.log("BeatLedger Postgres is listening on 127.0.0.1:54329");
await new Promise(() => {});
