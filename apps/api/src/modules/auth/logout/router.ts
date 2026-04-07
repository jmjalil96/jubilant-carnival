import { Router, type RequestHandler } from "express";

import { validatedRoute } from "../../../http/validation.js";
import type { LogoutService } from "./service.js";
import type { SessionManager } from "../shared/session.js";

type LogoutRouterDependencies = {
  service: LogoutService;
  sessionManager: SessionManager;
};

const setNoStoreResponseHeaders: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.vary("Cookie");
  next();
};

export function createLogoutRouter({
  service,
  sessionManager,
}: LogoutRouterDependencies): Router {
  const router = Router();

  router.delete(
    "/session",
    setNoStoreResponseHeaders,
    validatedRoute({}, async ({ req, res }) => {
      await service.logout({
        cookieHeader: req.get("cookie"),
        logger: req.log,
      });

      res.cookie(
        sessionManager.cookieName,
        "",
        sessionManager.getClearedCookieOptions(),
      );
      res.status(204).end();
    }),
  );

  return router;
}
