import { Router } from "express";

import { createSystemRouter } from "../modules/system/router.js";

type ApiRouterDependencies = {
  checkReadiness: () => Promise<void>;
};

export function apiRouter({ checkReadiness }: ApiRouterDependencies): Router {
  const router = Router();

  router.use(createSystemRouter({ checkReadiness }));

  return router;
}
