import { Router } from "express";

import type { Database } from "../../infra/db.js";
import type { AppEnv } from "../../infra/env.js";
import { createLoginRepository } from "./login/repository.js";
import { createLoginRouter } from "./login/router.js";
import { createLoginService } from "./login/service.js";
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
  const repository = createLoginRepository({ db });
  const service = createLoginService({
    repository,
    sessionManager,
    verifyPasswordHash,
  });

  router.use("/auth", createLoginRouter({ service, sessionManager }));

  return router;
}
