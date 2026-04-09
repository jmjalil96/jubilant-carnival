import { SERVICE_NOT_READY_ERROR_CODE } from "@jubilant-carnival/contracts/errors";

import { ApiError } from "@/lib/api/client";

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isServiceNotReadyError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 503 &&
    error.code === SERVICE_NOT_READY_ERROR_CODE
  );
}
