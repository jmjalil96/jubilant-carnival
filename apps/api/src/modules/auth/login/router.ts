import { Router } from "express";

import { validatedRoute } from "../../../http/validation.js";
import { createSessionBodySchema, type LoginResponse } from "./contracts.js";
import type { LoginService } from "./service.js";
import type { SessionManager } from "../shared/session.js";

type LoginRouterDependencies = {
  service: LoginService;
  sessionManager: SessionManager;
};

export function createLoginRouter({
  service,
  sessionManager,
}: LoginRouterDependencies): Router {
  const router = Router();

  router.post(
    "/session",
    validatedRoute(
      {
        body: createSessionBodySchema,
      },
      async ({ body, req, res }) => {
        const loginInput: Parameters<LoginService["login"]>[0] = {
          email: body.email,
          password: body.password,
          logger: req.log,
        };
        const userAgent = req.get("user-agent");

        loginInput.ipAddress = req.ip;

        if (userAgent !== undefined) {
          loginInput.userAgent = userAgent;
        }

        const result = await service.login(loginInput);

        res.cookie(
          sessionManager.cookieName,
          result.sessionToken,
          sessionManager.getCookieOptions(result.expiresAt),
        );

        const responseBody = {
          actor: result.actor,
          session: {
            expiresAt: result.expiresAt.toISOString(),
          },
        } satisfies LoginResponse;

        res.status(200).json(responseBody);
      },
    ),
  );

  return router;
}
