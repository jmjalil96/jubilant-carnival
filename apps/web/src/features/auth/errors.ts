import {
  AUTHENTICATION_REQUIRED_ERROR_CODE,
  EMAIL_NOT_VERIFIED_ERROR_CODE,
  INVALID_CREDENTIALS_ERROR_CODE,
  INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
  PASSWORD_RESET_REQUIRED_ERROR_CODE,
  VALIDATION_ERROR_CODE,
} from "@jubilant-carnival/contracts/errors";

import { ApiError } from "@/lib/api/client";

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAuthenticationRequiredError(
  error: unknown,
): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === AUTHENTICATION_REQUIRED_ERROR_CODE
  );
}

export function isInvalidCredentialsError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === INVALID_CREDENTIALS_ERROR_CODE
  );
}

export function isEmailNotVerifiedError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code === EMAIL_NOT_VERIFIED_ERROR_CODE
  );
}

export function isPasswordResetRequiredError(
  error: unknown,
): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code === PASSWORD_RESET_REQUIRED_ERROR_CODE
  );
}

export function isInvalidPasswordResetTokenError(
  error: unknown,
): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    error.code === INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE
  );
}

export function isValidationError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    error.code === VALIDATION_ERROR_CODE
  );
}
