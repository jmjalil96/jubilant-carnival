import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));

loadDotenv({ path: resolve(currentDir, "../.env"), quiet: true });

const { startServer } = await import("./server.js");

startServer();
