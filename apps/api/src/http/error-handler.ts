import type { ErrorRequestHandler } from "express";

import { AppError, toErrorResponse } from "./errors.js";

type RequestParsingError = Error & {
  status?: number;
  type?: string;
};

function isBodyParserError(error: unknown): error is RequestParsingError {
  return error instanceof Error && ("status" in error || "type" in error);
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) {
    _next(error);
    return;
  }

  if (
    isBodyParserError(error) &&
    error.type === "entity.parse.failed" &&
    error.status === 400
  ) {
    res.status(400).json(
      toErrorResponse({
        code: "invalid_json",
        message: "Request body must be valid JSON",
      }),
    );

    return;
  }

  if (
    isBodyParserError(error) &&
    error.type === "entity.too.large" &&
    error.status === 413
  ) {
    res.status(413).json(
      toErrorResponse({
        code: "payload_too_large",
        message: "Request body is too large",
      }),
    );

    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json(
      toErrorResponse({
        code: error.code,
        message: error.message,
        details: error.details,
      }),
    );

    return;
  }

  req.log.error({ err: error }, "Unhandled request error");
  res.status(500).json(
    toErrorResponse({
      code: "internal_server_error",
      message: "Internal server error",
    }),
  );
};
