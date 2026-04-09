import { passwordResetRequestBodySchema } from "@jubilant-carnival/contracts/auth";
import { Router, type RequestHandler } from "express";

import { validatedRoute } from "../../../../http/validation.js";
import type { PasswordResetRequestService } from "./service.js";

type PasswordResetRequestRouterDependencies = {
  service: PasswordResetRequestService;
};

const setNoStoreResponseHeaders: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

export function createPasswordResetRequestRouter({
  service,
}: PasswordResetRequestRouterDependencies): Router {
  const router = Router();

  router.post(
    "/password-reset",
    setNoStoreResponseHeaders,
    validatedRoute(
      {
        body: passwordResetRequestBodySchema,
      },
      async ({ body, req, res }) => {
        await service.requestPasswordReset({
          email: body.email,
          logger: req.log,
        });

        res.status(204).end();
      },
    ),
  );

  return router;
}
