import type { Express } from "express";

import { createApp } from "../../src/http/app.js";
import type { EmailService } from "../../src/infra/email/index.js";
import { createHttpLogger, createLogger } from "../../src/infra/logger.js";
import type { AuthRouterDependencies } from "../../src/modules/auth/router.js";

type TestAuthDependencies = Pick<AuthRouterDependencies, "db" | "nodeEnv"> & {
  emailService?: EmailService | undefined;
  passwordResetUrlBase?: string | undefined;
};

type CreateTestAppOptions = {
  checkReadiness?: () => Promise<void>;
  allowedOrigins?: readonly string[];
  auth?: TestAuthDependencies;
};

const noopEmailService: EmailService = {
  async send(): Promise<void> {},
  async sendPasswordReset(): Promise<void> {},
};

export function createTestApp({
  checkReadiness = async () => {},
  allowedOrigins = ["http://localhost:3000"],
  auth,
}: CreateTestAppOptions = {}): Express {
  const logger = createLogger({
    logLevel: "silent",
    nodeEnv: "test",
  });

  return createApp({
    allowedOrigins,
    checkReadiness,
    httpLogger: createHttpLogger({ logger }),
    ...(auth === undefined
      ? {}
      : {
          auth: {
            ...auth,
            emailService: auth.emailService ?? noopEmailService,
            passwordResetUrlBase:
              auth.passwordResetUrlBase ??
              "http://localhost:3000/reset-password",
          },
        }),
  });
}
