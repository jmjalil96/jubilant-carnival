import type { RequestHandler } from "express";

import { toErrorResponse } from "./errors.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(
    toErrorResponse({
      code: "not_found",
      message: "Route not found",
    }),
  );
};
