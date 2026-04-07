import cors, { type CorsOptions } from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";

import { AppError } from "./errors.js";
import { errorHandler } from "./error-handler.js";
import { notFoundHandler } from "./not-found.js";
import { apiRouter } from "./router.js";
import type { AuthRouterDependencies } from "../modules/auth/router.js";

type AppDependencies = {
  checkReadiness: () => Promise<void>;
  allowedOrigins: readonly string[];
  httpLogger: RequestHandler;
  auth?: AuthRouterDependencies;
};

function createCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  const allowedOriginSet = new Set(allowedOrigins);

  return {
    credentials: true,
    origin(origin, callback) {
      if (origin === undefined || allowedOriginSet.has(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new AppError({
          statusCode: 403,
          code: "cors_origin_not_allowed",
          message: "CORS origin not allowed",
          details: { origin },
        }),
      );
    },
  };
}

export function createApp({
  checkReadiness,
  allowedOrigins,
  httpLogger,
  auth,
}: AppDependencies): Express {
  const app = express();

  app.use(httpLogger);
  app.use(helmet());
  app.use(cors(createCorsOptions(allowedOrigins)));
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/api/v1",
    apiRouter({
      checkReadiness,
      ...(auth === undefined ? {} : { auth }),
    }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
