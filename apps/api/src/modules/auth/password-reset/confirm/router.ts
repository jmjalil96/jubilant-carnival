import { Router, type RequestHandler } from "express";

import { validatedRoute } from "../../../../http/validation.js";
import { passwordResetConfirmBodySchema } from "./contracts.js";
import type { PasswordResetConfirmService } from "./service.js";

type PasswordResetConfirmRouterDependencies = {
  service: PasswordResetConfirmService;
};

const setNoStoreResponseHeaders: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

export function createPasswordResetConfirmRouter({
  service,
}: PasswordResetConfirmRouterDependencies): Router {
  const router = Router();

  router.post(
    "/password-reset/confirm",
    setNoStoreResponseHeaders,
    validatedRoute(
      {
        body: passwordResetConfirmBodySchema,
      },
      async ({ body, req, res }) => {
        await service.confirmPasswordReset({
          token: body.token,
          password: body.password,
          logger: req.log,
        });

        res.status(204).end();
      },
    ),
  );

  return router;
}
