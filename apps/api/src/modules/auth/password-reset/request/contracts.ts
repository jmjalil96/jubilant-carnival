import { z } from "zod";

export const passwordResetRequestBodySchema = z.object({
  email: z.string().trim().min(1).max(320),
});

export type PasswordResetRequestBody = z.output<
  typeof passwordResetRequestBodySchema
>;
