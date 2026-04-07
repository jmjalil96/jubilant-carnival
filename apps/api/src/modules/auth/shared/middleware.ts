import type { RequestHandler } from "express";

import { AppError } from "../../../http/errors.js";
import type { AuthContextResolver } from "./auth-context.js";

const AUTHENTICATION_REQUIRED_ERROR = {
  statusCode: 401,
  code: "authentication_required",
  message: "Authentication required",
} as const;

type AuthMiddlewareDependencies = {
  resolver: AuthContextResolver;
};

export function createOptionalAuth({
  resolver,
}: AuthMiddlewareDependencies): RequestHandler {
  return async (req, _res, next) => {
    try {
      req.auth = await resolver.resolveFromCookieHeader(req.get("cookie"));
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createRequireAuth({
  resolver,
}: AuthMiddlewareDependencies): RequestHandler {
  return async (req, _res, next) => {
    try {
      const result = await resolver.resolveDetailedFromCookieHeader(
        req.get("cookie"),
      );

      if (result.kind === "unauthenticated") {
        req.auth = null;
        req.log.info(
          {
            reason: result.reason,
          },
          "Authentication required",
        );
        throw new AppError(AUTHENTICATION_REQUIRED_ERROR);
      }

      req.auth = result.auth;
      next();
    } catch (error) {
      next(error);
    }
  };
}
