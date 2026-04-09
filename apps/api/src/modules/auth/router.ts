import type { Actor } from "@jubilant-carnival/contracts/auth";
import { Router } from "express";

import type { Database } from "../../infra/db.js";
import type { EmailService } from "../../infra/email/index.js";
import type { AppEnv } from "../../infra/env.js";
import { createLoginRepository } from "./login/repository.js";
import { createLoginRouter } from "./login/router.js";
import { createLoginService } from "./login/service.js";
import { createLogoutRepository } from "./logout/repository.js";
import { createLogoutRouter } from "./logout/router.js";
import { createLogoutService } from "./logout/service.js";
import { createMeRouter } from "./me/router.js";
import { createPasswordResetConfirmRepository } from "./password-reset/confirm/repository.js";
import { createPasswordResetConfirmRouter } from "./password-reset/confirm/router.js";
import { createPasswordResetConfirmService } from "./password-reset/confirm/service.js";
import { createPasswordResetRequestRepository } from "./password-reset/request/repository.js";
import { createPasswordResetRequestRouter } from "./password-reset/request/router.js";
import { createPasswordResetRequestService } from "./password-reset/request/service.js";
import { createAuthContextResolver } from "./shared/auth-context.js";
import { createAuthContextRepository } from "./shared/auth-context-repository.js";
import type { AuthenticatedRequestContext } from "./shared/contracts.js";
import { createOptionalAuth, createRequireAuth } from "./shared/middleware.js";
import { hashPassword, verifyPasswordHash } from "./shared/password.js";
import { createSessionManager } from "./shared/session.js";

export type AuthRouterDependencies = {
  db: Database;
  nodeEnv: AppEnv["NODE_ENV"];
  emailService: EmailService;
  passwordResetUrlBase: string;
};

export function createAuthRouter({
  db,
  nodeEnv,
  emailService,
  passwordResetUrlBase,
}: AuthRouterDependencies): Router {
  const router = Router();
  const sessionManager = createSessionManager({ nodeEnv });
  const loginRepository = createLoginRepository({ db });
  const service = createLoginService({
    repository: loginRepository,
    sessionManager,
    verifyPasswordHash,
  });
  const logoutRepository = createLogoutRepository({ db });
  const logoutService = createLogoutService({
    repository: logoutRepository,
  });
  const passwordResetRequestRepository = createPasswordResetRequestRepository({
    db,
  });
  const passwordResetRequestService = createPasswordResetRequestService({
    repository: passwordResetRequestRepository,
    emailService,
    passwordResetUrlBase,
  });
  const passwordResetConfirmRepository = createPasswordResetConfirmRepository({
    db,
  });
  const passwordResetConfirmService = createPasswordResetConfirmService({
    repository: passwordResetConfirmRepository,
    hashPassword,
  });
  const authContextRepository = createAuthContextRepository({ db });
  const authContextResolver = createAuthContextResolver({
    repository: authContextRepository,
  });
  const requireAuth = createRequireAuth({
    resolver: authContextResolver,
  });

  router.use("/auth", createLoginRouter({ service, sessionManager }));
  router.use(
    "/auth",
    createLogoutRouter({ service: logoutService, sessionManager }),
  );
  router.use(
    "/auth",
    createPasswordResetRequestRouter({ service: passwordResetRequestService }),
  );
  router.use(
    "/auth",
    createPasswordResetConfirmRouter({ service: passwordResetConfirmService }),
  );
  router.use("/auth", createMeRouter({ requireAuth }));

  return router;
}

export {
  createAuthContextRepository,
  createAuthContextResolver,
  createOptionalAuth,
  createRequireAuth,
};
export type { Actor, AuthenticatedRequestContext };
