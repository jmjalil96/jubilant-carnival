import type { Database } from "../../infra/db.js";
import { appMetadata } from "../../infra/schema.js";

export function createDatabaseReadinessCheck(db: Database) {
  return async (): Promise<void> => {
    await db.select({ key: appMetadata.key }).from(appMetadata).limit(1);
  };
}
