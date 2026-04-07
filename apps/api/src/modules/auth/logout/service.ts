import type { Logger } from "pino";

import type { LogoutRepository } from "./repository.js";
import {
  hashSessionToken,
  readSessionTokenFromCookieHeader,
} from "../shared/session.js";

type LogoutServiceDependencies = {
  repository: LogoutRepository;
};

type LogoutInput = {
  cookieHeader: string | undefined;
  logger: Logger;
};

export type LogoutService = ReturnType<typeof createLogoutService>;

export function createLogoutService({ repository }: LogoutServiceDependencies) {
  return {
    async logout({ cookieHeader, logger }: LogoutInput): Promise<void> {
      const sessionToken = readSessionTokenFromCookieHeader(cookieHeader);

      if (sessionToken === null) {
        logger.info(
          {
            reason: "missing_or_invalid_session_cookie",
          },
          "Logout no-op",
        );
        return;
      }

      const result = await repository.revokeSessionByTokenHash(
        hashSessionToken(sessionToken),
        new Date(),
      );

      if (result.kind === "revoked") {
        logger.info(
          {
            sessionId: result.sessionId,
          },
          "Logout succeeded",
        );
        return;
      }

      if (result.kind === "already_revoked") {
        logger.info(
          {
            sessionId: result.sessionId,
            reason: "already_revoked",
          },
          "Logout no-op",
        );
        return;
      }

      logger.info(
        {
          reason: "session_not_found",
        },
        "Logout no-op",
      );
    },
  };
}
