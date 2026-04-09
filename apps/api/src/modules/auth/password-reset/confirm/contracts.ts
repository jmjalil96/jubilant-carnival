import { z } from "zod";

export const passwordResetConfirmBodySchema = z.object({
  token: z.string().min(1).max(1_024),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(1_024),
});

export type PasswordResetConfirmBody = z.output<
  typeof passwordResetConfirmBodySchema
>;
