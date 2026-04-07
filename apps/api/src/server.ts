import type { Server } from "node:http";
import { createApp } from "./http/app.js";
import { loadEnv } from "./infra/env.js";
import { createDatabaseClient } from "./infra/db.js";
import { createSmtpEmailService } from "./infra/email/index.js";
import { createHttpLogger, createLogger } from "./infra/logger.js";
import { createDatabaseReadinessCheck } from "./modules/system/readiness.js";

async function closeServer(httpServer: Server): Promise<void> {
  await new Promise<void>((resolveServer, rejectServer) => {
    httpServer.close((error) => {
      if (error) {
        rejectServer(error);
        return;
      }

      resolveServer();
    });
  });
}

export function startServer(): void {
  const env = loadEnv();
  const logger = createLogger({
    logLevel: env.LOG_LEVEL,
    nodeEnv: env.NODE_ENV,
  });
  const httpLogger = createHttpLogger({ logger });
  const emailService = createSmtpEmailService({
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpSecure: env.SMTP_SECURE,
    smtpUsername: env.SMTP_USERNAME,
    smtpPassword: env.SMTP_PASSWORD,
    from: env.EMAIL_FROM,
    ...(env.EMAIL_REPLY_TO === undefined
      ? {}
      : { replyTo: env.EMAIL_REPLY_TO }),
  });
  const { db, pool } = createDatabaseClient({
    connectionString: env.DATABASE_URL,
    onError: (error) => {
      logger.error({ err: error }, "Unexpected PostgreSQL pool error");
    },
  });
  const app = createApp({
    allowedOrigins: env.CORS_ORIGINS,
    checkReadiness: createDatabaseReadinessCheck(db),
    httpLogger,
    auth: {
      db,
      nodeEnv: env.NODE_ENV,
      emailService,
      passwordResetUrlBase: env.PASSWORD_RESET_URL_BASE,
    },
  });
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API server listening");
  });

  let isShuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "Shutting down API server");

    const shutdownTimer = setTimeout(() => {
      logger.error(
        { signal, timeoutMs: env.SHUTDOWN_TIMEOUT_MS },
        "Forced shutdown after timeout",
      );
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    shutdownTimer.unref();

    let exitCode = 0;

    try {
      await closeServer(server);
    } catch (error) {
      exitCode = 1;
      logger.error({ err: error }, "Failed to close HTTP server cleanly");
    }

    try {
      await pool.end();
    } catch (error) {
      exitCode = 1;
      logger.error({ err: error }, "Failed to close database pool cleanly");
    }

    clearTimeout(shutdownTimer);
    process.exit(exitCode);
  }

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}
