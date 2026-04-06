import type { Express } from "express";

import { createApp } from "../../src/http/app.js";
import { createHttpLogger, createLogger } from "../../src/infra/logger.js";

type CreateTestAppOptions = {
  checkReadiness?: () => Promise<void>;
  allowedOrigins?: readonly string[];
};

export function createTestApp({
  checkReadiness = async () => {},
  allowedOrigins = ["http://localhost:3000"],
}: CreateTestAppOptions = {}): Express {
  const logger = createLogger({
    logLevel: "silent",
    nodeEnv: "test",
  });

  return createApp({
    allowedOrigins,
    checkReadiness,
    httpLogger: createHttpLogger({ logger }),
  });
}
