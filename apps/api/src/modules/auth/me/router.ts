import type { CurrentSession } from "@jubilant-carnival/contracts/auth";
import { Router, type RequestHandler } from "express";

import { validatedRoute } from "../../../http/validation.js";
import {
  toCurrentSessionResponse,
  type AuthenticatedRequestContext,
} from "../shared/contracts.js";

type MeRouterDependencies = {
  requireAuth: RequestHandler;
};

const setNoStoreResponseHeaders: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.vary("Cookie");
  next();
};

function assertAuthenticatedRequestContext(
  auth: AuthenticatedRequestContext | null | undefined,
): AuthenticatedRequestContext {
  if (auth === undefined || auth === null) {
    throw new Error("Authenticated request is missing auth context");
  }

  return auth;
}

export function createMeRouter({ requireAuth }: MeRouterDependencies): Router {
  const router = Router();

  router.get(
    "/me",
    setNoStoreResponseHeaders,
    requireAuth,
    validatedRoute({}, ({ req, res }) => {
      const auth = assertAuthenticatedRequestContext(req.auth);

      req.log.info(
        {
          userId: auth.actor.user.id,
          tenantId: auth.actor.tenant.id,
          sessionId: auth.session.id,
        },
        "Current session resolved",
      );

      const responseBody = toCurrentSessionResponse({
        actor: auth.actor,
        expiresAt: auth.session.expiresAt,
      }) satisfies CurrentSession;

      res.status(200).json(responseBody);
    }),
  );

  return router;
}
