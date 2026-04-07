import { Router } from "express";

import type { Database } from "../../infra/db.js";
import type { AppEnv } from "../../infra/env.js";
import { createLoginRepository } from "./login/repository.js";
import { createLoginRouter } from "./login/router.js";
import { createLoginService } from "./login/service.js";
import { createMeRouter } from "./me/router.js";
import { createAuthContextResolver } from "./shared/auth-context.js";
import { createAuthContextRepository } from "./shared/auth-context-repository.js";
import type { Actor, AuthenticatedRequestContext } from "./shared/contracts.js";
import { createOptionalAuth, createRequireAuth } from "./shared/middleware.js";
import { verifyPasswordHash } from "./shared/password.js";
import { createSessionManager } from "./shared/session.js";

export type AuthRouterDependencies = {
  db: Database;
  nodeEnv: AppEnv["NODE_ENV"];
};

export function createAuthRouter({
  db,
  nodeEnv,
}: AuthRouterDependencies): Router {
  const router = Router();
  const sessionManager = createSessionManager({ nodeEnv });
  const loginRepository = createLoginRepository({ db });
  const service = createLoginService({
    repository: loginRepository,
    sessionManager,
    verifyPasswordHash,
  });
  const authContextRepository = createAuthContextRepository({ db });
  const authContextResolver = createAuthContextResolver({
    repository: authContextRepository,
  });
  const requireAuth = createRequireAuth({
    resolver: authContextResolver,
  });

  router.use("/auth", createLoginRouter({ service, sessionManager }));
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
