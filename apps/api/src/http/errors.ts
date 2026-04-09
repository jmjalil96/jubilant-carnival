import type { ApiErrorEnvelope } from "@jubilant-carnival/contracts/errors";

type AppErrorOptions = {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor({ statusCode, code, message, details }: AppErrorOptions) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse({
  code,
  message,
  details,
}: {
  code: string;
  message: string;
  details?: unknown;
}): ApiErrorEnvelope {
  return details === undefined
    ? {
        error: {
          code,
          message,
        },
      }
    : {
        error: {
          code,
          message,
          details,
        },
      };
}
