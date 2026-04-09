import { z } from "zod";

export const EMAIL_MAX_LENGTH = 320;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 1_024;
export const PASSWORD_RESET_TOKEN_MAX_LENGTH = 1_024;

export const emailSchema = z.string().trim().min(1).max(EMAIL_MAX_LENGTH);
export const passwordSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);
export const passwordResetTokenSchema = z
  .string()
  .min(1)
  .max(PASSWORD_RESET_TOKEN_MAX_LENGTH);

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
  email: emailSchema,
  password: passwordSchema,
});

export const passwordResetRequestBodySchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmBodySchema = z.object({
  token: passwordResetTokenSchema,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, "Password must be at least 8 characters")
    .max(PASSWORD_MAX_LENGTH),
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
