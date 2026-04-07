import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../../../../infra/db.js";
import {
  tenants,
  userPasswords,
  userTokens,
  users,
} from "../../../../infra/schema.js";

type PasswordResetRequestRepositoryDependencies = {
  db: Database;
};

type IssuePasswordResetTokenInput = {
  emailNormalized: string;
  tokenId: string;
  tokenHash: string;
  expiresAt: Date;
  now: Date;
};

type PasswordResetRequestNoopReason =
  | "user_not_found_or_missing_password_row"
  | "user_not_active"
  | "tenant_not_active"
  | "email_not_verified";

export type IssuePasswordResetTokenResult =
  | {
      kind: "issued";
      userId: string;
      email: string;
      expiresAt: Date;
    }
  | {
      kind: "noop";
      reason: PasswordResetRequestNoopReason;
    };

export type PasswordResetRequestRepository = ReturnType<
  typeof createPasswordResetRequestRepository
>;

export function createPasswordResetRequestRepository({
  db,
}: PasswordResetRequestRepositoryDependencies) {
  return {
    async issuePasswordResetToken({
      emailNormalized,
      tokenId,
      tokenHash,
      expiresAt,
      now,
    }: IssuePasswordResetTokenInput): Promise<IssuePasswordResetTokenResult> {
      return await db.transaction(async (tx) => {
        const [initialCandidate] = await tx
          .select({
            userId: users.id,
            email: users.email,
          })
          .from(users)
          .innerJoin(tenants, eq(users.tenantId, tenants.id))
          .innerJoin(userPasswords, eq(userPasswords.userId, users.id))
          .where(eq(users.emailNormalized, emailNormalized))
          .limit(1);

        if (initialCandidate === undefined) {
          return {
            kind: "noop",
            reason: "user_not_found_or_missing_password_row",
          };
        }

        await tx
          .select({
            id: userTokens.id,
          })
          .from(userTokens)
          .where(
            and(
              eq(userTokens.userId, initialCandidate.userId),
              eq(userTokens.kind, "password_reset"),
              isNull(userTokens.consumedAt),
            ),
          )
          .for("update", { of: [userTokens] });

        const [candidate] = await tx
          .select({
            userId: users.id,
            email: users.email,
            userStatus: users.status,
            emailVerifiedAt: users.emailVerifiedAt,
            tenantStatus: tenants.status,
          })
          .from(users)
          .innerJoin(tenants, eq(users.tenantId, tenants.id))
          .innerJoin(userPasswords, eq(userPasswords.userId, users.id))
          .where(eq(users.id, initialCandidate.userId))
          .limit(1)
          .for("update", { of: [users, tenants, userPasswords] });

        if (candidate === undefined) {
          return {
            kind: "noop",
            reason: "user_not_found_or_missing_password_row",
          };
        }

        if (candidate.userStatus !== "active") {
          return {
            kind: "noop",
            reason: "user_not_active",
          };
        }

        if (candidate.tenantStatus !== "active") {
          return {
            kind: "noop",
            reason: "tenant_not_active",
          };
        }

        if (candidate.emailVerifiedAt === null) {
          return {
            kind: "noop",
            reason: "email_not_verified",
          };
        }

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
            ),
          );

        await tx.insert(userTokens).values({
          id: tokenId,
          userId: candidate.userId,
          kind: "password_reset",
          tokenHash,
          expiresAt,
        });

        return {
          kind: "issued",
          userId: candidate.userId,
          email: candidate.email,
          expiresAt,
        };
      });
    },
  };
}
