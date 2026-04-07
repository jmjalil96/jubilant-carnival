import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

type DatabaseClientOptions = {
  connectionString: string;
  onError?: (error: Error) => void;
};

type DatabaseClient = {
  db: Database;
  pool: Pool;
};

export function createDatabaseClient({
  connectionString,
  onError,
}: DatabaseClientOptions): DatabaseClient {
  const pool = new Pool({
    connectionString,
  });

  if (onError !== undefined) {
    pool.on("error", onError);
  }

  const db = drizzle({
    client: pool,
    schema,
  });

  return { db, pool };
}
