import { Router } from "express";

import {
  createAuthRouter,
  type AuthRouterDependencies,
} from "../modules/auth/router.js";
import { createSystemRouter } from "../modules/system/router.js";

type ApiRouterDependencies = {
  checkReadiness: () => Promise<void>;
  auth?: AuthRouterDependencies;
};

export function apiRouter({
  checkReadiness,
  auth,
}: ApiRouterDependencies): Router {
  const router = Router();

  router.use(createSystemRouter({ checkReadiness }));
  if (auth !== undefined) {
    router.use(createAuthRouter(auth));
  }

  return router;
}
