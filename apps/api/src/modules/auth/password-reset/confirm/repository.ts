import { and, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "../../../../infra/db.js";
import {
  sessions,
  tenants,
  userPasswords,
  userTokens,
  users,
} from "../../../../infra/schema.js";

type PasswordResetConfirmRepositoryDependencies = {
  db: Database;
};

type ConsumePasswordResetTokenInput = {
  tokenHash: string;
  passwordHash: string;
  now: Date;
};

export type InvalidPasswordResetTokenReason =
  | "token_not_found"
  | "token_consumed"
  | "token_expired"
  | "user_not_found"
  | "user_not_active"
  | "tenant_not_active"
  | "email_not_verified"
  | "missing_password_row";

type PrecheckPasswordResetTokenResult =
  | {
      kind: "valid";
    }
  | {
      kind: "invalid_token";
      reason: InvalidPasswordResetTokenReason;
    };

export type ConsumePasswordResetTokenResult =
  | {
      kind: "confirmed";
      userId: string;
    }
  | {
      kind: "invalid_token";
      reason: InvalidPasswordResetTokenReason;
    };

export type PasswordResetConfirmRepository = ReturnType<
  typeof createPasswordResetConfirmRepository
>;

class MissingPasswordRowDuringConsumeError extends Error {
  constructor() {
    super("Password row disappeared during confirm consume");
    this.name = "MissingPasswordRowDuringConsumeError";
  }
}

function toInvalidToken(reason: InvalidPasswordResetTokenReason): {
  kind: "invalid_token";
  reason: InvalidPasswordResetTokenReason;
} {
  return {
    kind: "invalid_token",
    reason,
  };
}

export function createPasswordResetConfirmRepository({
  db,
}: PasswordResetConfirmRepositoryDependencies) {
  return {
    async precheckPasswordResetToken(
      tokenHash: string,
      now: Date,
    ): Promise<PrecheckPasswordResetTokenResult> {
      const [token] = await db
        .select({
          userId: userTokens.userId,
          expiresAt: userTokens.expiresAt,
          consumedAt: userTokens.consumedAt,
        })
        .from(userTokens)
        .where(
          and(
            eq(userTokens.tokenHash, tokenHash),
            eq(userTokens.kind, "password_reset"),
          ),
        )
        .limit(1);

      if (token === undefined) {
        return toInvalidToken("token_not_found");
      }

      if (token.consumedAt !== null) {
        return toInvalidToken("token_consumed");
      }

      if (token.expiresAt.getTime() <= now.getTime()) {
        return toInvalidToken("token_expired");
      }

      const [candidate] = await db
        .select({
          userId: users.id,
          userStatus: users.status,
          emailVerifiedAt: users.emailVerifiedAt,
          tenantStatus: tenants.status,
          passwordUserId: userPasswords.userId,
        })
        .from(users)
        .innerJoin(tenants, eq(users.tenantId, tenants.id))
        .leftJoin(userPasswords, eq(userPasswords.userId, users.id))
        .where(eq(users.id, token.userId))
        .limit(1);

      if (candidate === undefined) {
        return toInvalidToken("user_not_found");
      }

      if (candidate.userStatus !== "active") {
        return toInvalidToken("user_not_active");
      }

      if (candidate.tenantStatus !== "active") {
        return toInvalidToken("tenant_not_active");
      }

      if (candidate.emailVerifiedAt === null) {
        return toInvalidToken("email_not_verified");
      }

      if (candidate.passwordUserId === null) {
        return toInvalidToken("missing_password_row");
      }

      return {
        kind: "valid",
      };
    },

    async consumePasswordResetToken({
      tokenHash,
      passwordHash,
      now,
    }: ConsumePasswordResetTokenInput): Promise<ConsumePasswordResetTokenResult> {
      try {
        return await db.transaction(async (tx) => {
          const [token] = await tx
            .select({
              id: userTokens.id,
              userId: userTokens.userId,
              expiresAt: userTokens.expiresAt,
              consumedAt: userTokens.consumedAt,
            })
            .from(userTokens)
            .where(
              and(
                eq(userTokens.tokenHash, tokenHash),
                eq(userTokens.kind, "password_reset"),
              ),
            )
            .limit(1)
            .for("update", { of: [userTokens] });

          if (token === undefined) {
            return toInvalidToken("token_not_found");
          }

          if (token.consumedAt !== null) {
            return toInvalidToken("token_consumed");
          }

          if (token.expiresAt.getTime() <= now.getTime()) {
            return toInvalidToken("token_expired");
          }

          const [candidate] = await tx
            .select({
              userId: users.id,
              userStatus: users.status,
              emailVerifiedAt: users.emailVerifiedAt,
              tenantStatus: tenants.status,
            })
            .from(users)
            .innerJoin(tenants, eq(users.tenantId, tenants.id))
            .where(eq(users.id, token.userId))
            .limit(1)
            .for("update", { of: [users, tenants] });

          if (candidate === undefined) {
            return toInvalidToken("user_not_found");
          }

          if (candidate.userStatus !== "active") {
            return toInvalidToken("user_not_active");
          }

          if (candidate.tenantStatus !== "active") {
            return toInvalidToken("tenant_not_active");
          }

          if (candidate.emailVerifiedAt === null) {
            return toInvalidToken("email_not_verified");
          }

          const [passwordPresence] = await tx
            .select({
              userId: userPasswords.userId,
            })
            .from(userPasswords)
            .where(eq(userPasswords.userId, candidate.userId))
            .limit(1);

          if (passwordPresence === undefined) {
            return toInvalidToken("missing_password_row");
          }

          await tx
            .update(sessions)
            .set({
              revokedAt: now,
              updatedAt: now,
            })
            .where(
              and(
                eq(sessions.userId, candidate.userId),
                isNull(sessions.revokedAt),
              ),
            );

          const [passwordState] = await tx
            .select({
              userId: userPasswords.userId,
            })
            .from(userPasswords)
            .where(eq(userPasswords.userId, candidate.userId))
            .limit(1)
            .for("update", { of: [userPasswords] });

          if (passwordState === undefined) {
            throw new MissingPasswordRowDuringConsumeError();
          }

          await tx
            .update(userPasswords)
            .set({
              passwordHash,
              passwordUpdatedAt: now,
              resetRequired: false,
              updatedAt: now,
            })
            .where(eq(userPasswords.userId, candidate.userId));

          await tx
            .update(userTokens)
            .set({
              consumedAt: now,
            })
            .where(
              and(
                eq(userTokens.userId, candidate.userId),
                eq(userTokens.kind, "password_reset"),
                isNull(userTokens.consumedAt),
                gt(userTokens.expiresAt, now),
              ),
            );

          return {
            kind: "confirmed",
            userId: candidate.userId,
          };
        });
      } catch (error) {
        if (error instanceof MissingPasswordRowDuringConsumeError) {
          return toInvalidToken("missing_password_row");
        }

        throw error;
      }
    },
  };
}
