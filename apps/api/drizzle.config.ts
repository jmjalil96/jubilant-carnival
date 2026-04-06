import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { parseDatabaseEnv } from "./src/infra/env.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));

loadDotenv({ path: resolve(currentDir, ".env"), quiet: true });

const { DATABASE_URL } = parseDatabaseEnv(process.env);

export default defineConfig({
  out: "./drizzle",
  schema: "./src/infra/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
