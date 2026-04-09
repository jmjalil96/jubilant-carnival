import { z } from "zod";

import { ApiError } from "@/lib/api/client";

export const actorSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string().nullable(),
  }),
  tenant: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
  }),
  roleKeys: z.array(z.string()),
});

export const currentSessionSchema = z.object({
  actor: actorSchema,
  session: z.object({
    expiresAt: z.string().datetime({ offset: true }),
  }),
});

export const loginBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(1_024, "Password must be 1024 characters or fewer"),
});

export const passwordResetRequestBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer"),
});

export const passwordResetConfirmBodySchema = z.object({
  token: z.string().min(1).max(1_024),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(1_024, "Password must be 1024 characters or fewer"),
});

export type Actor = z.infer<typeof actorSchema>;
export type CurrentSession = z.infer<typeof currentSessionSchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type PasswordResetRequestBody = z.infer<
  typeof passwordResetRequestBodySchema
>;
export type PasswordResetConfirmBody = z.infer<
  typeof passwordResetConfirmBodySchema
>;

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAuthenticationRequiredError(
  error: unknown,
): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === "authentication_required"
  );
}

export function isInvalidCredentialsError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === "invalid_credentials"
  );
}

export function isEmailNotVerifiedError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code === "email_not_verified"
  );
}

export function isPasswordResetRequiredError(
  error: unknown,
): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code === "password_reset_required"
  );
}

export function isInvalidPasswordResetTokenError(
  error: unknown,
): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    error.code === "invalid_password_reset_token"
  );
}

export function isValidationError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    error.code === "validation_error"
  );
}
