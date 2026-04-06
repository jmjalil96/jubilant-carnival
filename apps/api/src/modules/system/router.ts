import { Router } from "express";

import { createSystemService } from "./service.js";

type SystemRouterDependencies = {
  checkReadiness: () => Promise<void>;
};

export function createSystemRouter({
  checkReadiness,
}: SystemRouterDependencies): Router {
  const router = Router();
  const systemService = createSystemService({ checkReadiness });

  router.get("/health", (_req, res) => {
    res.status(200).json(systemService.getHealthStatus());
  });

  router.get("/ready", async (_req, res) => {
    res.status(200).json(await systemService.getReadinessStatus());
  });

  return router;
}
