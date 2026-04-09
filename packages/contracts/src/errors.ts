import { z } from "zod";

export const AUTHENTICATION_REQUIRED_ERROR_CODE = "authentication_required";
export const INVALID_CREDENTIALS_ERROR_CODE = "invalid_credentials";
export const EMAIL_NOT_VERIFIED_ERROR_CODE = "email_not_verified";
export const PASSWORD_RESET_REQUIRED_ERROR_CODE = "password_reset_required";
export const INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE =
  "invalid_password_reset_token";
export const SERVICE_NOT_READY_ERROR_CODE = "service_not_ready";
export const VALIDATION_ERROR_CODE = "validation_error";

export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
