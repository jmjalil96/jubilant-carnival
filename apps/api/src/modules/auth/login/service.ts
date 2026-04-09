import {
  EMAIL_NOT_VERIFIED_ERROR_CODE,
  INVALID_CREDENTIALS_ERROR_CODE,
  PASSWORD_RESET_REQUIRED_ERROR_CODE,
  type Actor,
} from "@jubilant-carnival/contracts";
import type { Logger } from "pino";

import { AppError } from "../../../http/errors.js";
import type {
  CreateSessionAfterRecheckResult,
  LoginCandidate,
  LoginRepository,
} from "./repository.js";
import type { SessionManager } from "../shared/session.js";

type VerifyPasswordHash = (
  passwordHash: string,
  password: string,
) => Promise<boolean>;

type LoginServiceDependencies = {
  repository: LoginRepository;
  sessionManager: SessionManager;
  verifyPasswordHash: VerifyPasswordHash;
};

type LoginInput = {
  email: string;
  password: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  logger: Logger;
};

type LoginResult = {
  actor: Actor;
  sessionToken: string;
  expiresAt: Date;
};

type PgConstraintError = Error & {
  code?: string;
  constraint?: string;
};

const INVALID_CREDENTIALS_ERROR = {
  statusCode: 401,
  code: INVALID_CREDENTIALS_ERROR_CODE,
  message: "Invalid email or password",
} as const;

const EMAIL_NOT_VERIFIED_ERROR = {
  statusCode: 403,
  code: EMAIL_NOT_VERIFIED_ERROR_CODE,
  message: "Email address is not verified",
} as const;

const PASSWORD_RESET_REQUIRED_ERROR = {
  statusCode: 403,
  code: PASSWORD_RESET_REQUIRED_ERROR_CODE,
  message: "Password reset is required",
} as const;

export type LoginService = ReturnType<typeof createLoginService>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toInvalidCredentialsError(): AppError {
  return new AppError(INVALID_CREDENTIALS_ERROR);
}

function toEmailNotVerifiedError(): AppError {
  return new AppError(EMAIL_NOT_VERIFIED_ERROR);
}

function toPasswordResetRequiredError(): AppError {
  return new AppError(PASSWORD_RESET_REQUIRED_ERROR);
}

function isSessionTokenHashConflict(
  error: unknown,
): error is PgConstraintError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "constraint" in error &&
    (error as PgConstraintError).code === "23505" &&
    (error as PgConstraintError).constraint === "sessions_token_hash_unique"
  );
}

function isSessionUserForeignKeyViolation(
  error: unknown,
): error is PgConstraintError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "constraint" in error &&
    (error as PgConstraintError).code === "23503" &&
    (error as PgConstraintError).constraint === "sessions_user_id_users_id_fk"
  );
}

function mapRecheckFailureToError(
  result: Exclude<CreateSessionAfterRecheckResult, { kind: "created" }>,
): AppError {
  if (result.kind === "email_not_verified") {
    return toEmailNotVerifiedError();
  }

  if (result.kind === "password_reset_required") {
    return toPasswordResetRequiredError();
  }

  return toInvalidCredentialsError();
}

function isUsableLoginCandidate(
  candidate: LoginCandidate,
): candidate is LoginCandidate & {
  passwordHash: string;
  passwordUpdatedAt: Date;
  resetRequired: boolean;
  userStatus: "active";
  tenantStatus: "active";
} {
  return (
    (candidate.userStatus !== "active" ||
      candidate.tenantStatus !== "active" ||
      candidate.passwordHash === null ||
      candidate.passwordUpdatedAt === null ||
      candidate.resetRequired === null) === false
  );
}

export function createLoginService({
  repository,
  sessionManager,
  verifyPasswordHash,
}: LoginServiceDependencies) {
  return {
    async login({
      email,
      password,
      ipAddress,
      userAgent,
      logger,
    }: LoginInput): Promise<LoginResult> {
      const emailNormalized = normalizeEmail(email);
      const candidate =
        await repository.findLoginCandidateByEmailNormalized(emailNormalized);

      if (candidate === null) {
        logger.info(
          { emailNormalized, reason: "user_not_found" },
          "Login failed",
        );
        throw toInvalidCredentialsError();
      }

      if (!isUsableLoginCandidate(candidate)) {
        logger.info(
          {
            emailNormalized,
            userId: candidate.userId,
            tenantId: candidate.tenantId,
            reason: "candidate_not_allowed",
          },
          "Login failed",
        );
        throw toInvalidCredentialsError();
      }

      let passwordVerified = false;

      try {
        passwordVerified = await verifyPasswordHash(
          candidate.passwordHash,
          password,
        );
      } catch (error) {
        logger.warn(
          {
            err: error,
            emailNormalized,
            userId: candidate.userId,
            reason: "password_verification_error",
          },
          "Password verification failed unexpectedly",
        );
      }

      if (!passwordVerified) {
        logger.info(
          {
            emailNormalized,
            userId: candidate.userId,
            tenantId: candidate.tenantId,
            reason: "password_mismatch",
          },
          "Login failed",
        );
        throw toInvalidCredentialsError();
      }

      if (candidate.emailVerifiedAt === null) {
        logger.info(
          {
            emailNormalized,
            userId: candidate.userId,
            tenantId: candidate.tenantId,
            reason: "email_not_verified",
          },
          "Login blocked",
        );
        throw toEmailNotVerifiedError();
      }

      if (candidate.resetRequired) {
        logger.info(
          {
            emailNormalized,
            userId: candidate.userId,
            tenantId: candidate.tenantId,
            reason: "password_reset_required",
          },
          "Login blocked",
        );
        throw toPasswordResetRequiredError();
      }

      let createdSession:
        | {
            sessionId: string;
            sessionToken: string;
            expiresAt: Date;
          }
        | undefined;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const nextSession = sessionManager.issueSession();

        try {
          const sessionCreateResult =
            await repository.createSessionAfterRecheck({
              userId: candidate.userId,
              expectedPasswordUpdatedAt: candidate.passwordUpdatedAt,
              sessionId: nextSession.sessionId,
              tokenHash: nextSession.tokenHash,
              expiresAt: nextSession.expiresAt,
              ipAddress,
              userAgent,
            });

          if (sessionCreateResult.kind !== "created") {
            logger.info(
              {
                emailNormalized,
                userId: candidate.userId,
                tenantId: candidate.tenantId,
                reason: sessionCreateResult.kind,
              },
              "Login blocked after session recheck",
            );
            throw mapRecheckFailureToError(sessionCreateResult);
          }

          createdSession = nextSession;
          break;
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }

          if (isSessionUserForeignKeyViolation(error)) {
            logger.info(
              {
                emailNormalized,
                userId: candidate.userId,
                tenantId: candidate.tenantId,
                reason: "session_user_fk_violation",
              },
              "Login failed after concurrent user deletion",
            );
            throw toInvalidCredentialsError();
          }

          if (attempt === 0 && isSessionTokenHashConflict(error)) {
            logger.warn(
              {
                emailNormalized,
                userId: candidate.userId,
                tenantId: candidate.tenantId,
                reason: "session_token_hash_conflict",
              },
              "Retrying login after session token collision",
            );
            continue;
          }

          throw error;
        }
      }

      if (createdSession === undefined) {
        throw new Error("Failed to create session");
      }

      const roleKeys = await repository.listRoleKeysForUser(candidate.userId);

      logger.info(
        {
          emailNormalized,
          userId: candidate.userId,
          tenantId: candidate.tenantId,
          sessionId: createdSession.sessionId,
        },
        "Login succeeded",
      );

      return {
        actor: {
          user: {
            id: candidate.userId,
            email: candidate.email,
            displayName: candidate.displayName,
          },
          tenant: {
            id: candidate.tenantId,
            slug: candidate.tenantSlug,
            name: candidate.tenantName,
          },
          roleKeys,
        },
        sessionToken: createdSession.sessionToken,
        expiresAt: createdSession.expiresAt,
      };
    },
  };
}
