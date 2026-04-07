import type { Logger } from "pino";

import { AppError } from "../../../../http/errors.js";
import type { PasswordResetConfirmRepository } from "./repository.js";
import { hashPasswordResetToken } from "../token.js";

type PasswordResetConfirmServiceDependencies = {
  repository: PasswordResetConfirmRepository;
  hashPassword: (password: string) => Promise<string>;
};

type PasswordResetConfirmInput = {
  token: string;
  password: string;
  logger: Logger;
};

const INVALID_PASSWORD_RESET_TOKEN_ERROR = {
  statusCode: 400,
  code: "invalid_password_reset_token",
  message: "Invalid or expired password reset token",
} as const;

export type PasswordResetConfirmService = ReturnType<
  typeof createPasswordResetConfirmService
>;

function toInvalidPasswordResetTokenError(): AppError {
  return new AppError(INVALID_PASSWORD_RESET_TOKEN_ERROR);
}

export function createPasswordResetConfirmService({
  repository,
  hashPassword,
}: PasswordResetConfirmServiceDependencies) {
  return {
    async confirmPasswordReset({
      token,
      password,
      logger,
    }: PasswordResetConfirmInput): Promise<void> {
      const tokenHash = hashPasswordResetToken(token);
      const precheckResult = await repository.precheckPasswordResetToken(
        tokenHash,
        new Date(),
      );

      if (precheckResult.kind !== "valid") {
        logger.info(
          {
            reason: precheckResult.reason,
          },
          "Password reset confirm failed",
        );
        throw toInvalidPasswordResetTokenError();
      }

      const passwordHash = await hashPassword(password);
      const result = await repository.consumePasswordResetToken({
        tokenHash,
        passwordHash,
        now: new Date(),
      });

      if (result.kind !== "confirmed") {
        logger.info(
          {
            reason: result.reason,
          },
          "Password reset confirm failed",
        );
        throw toInvalidPasswordResetTokenError();
      }

      logger.info(
        {
          userId: result.userId,
        },
        "Password reset confirmed",
      );
    },
  };
}
