import { asc, eq } from "drizzle-orm";

import type { Database } from "../../../infra/db.js";
import {
  roles,
  sessions,
  tenants,
  userPasswords,
  userRoles,
  users,
} from "../../../infra/schema.js";
import type {
  DetailedAuthContextResolution,
  InvalidAuthReason,
} from "./auth-context.js";

type AuthContextRepositoryDependencies = {
  db: Database;
};

function toUnauthenticated(
  reason: InvalidAuthReason,
): DetailedAuthContextResolution {
  return {
    kind: "unauthenticated",
    reason,
  };
}

export type AuthContextRepository = ReturnType<
  typeof createAuthContextRepository
>;

export function createAuthContextRepository({
  db,
}: AuthContextRepositoryDependencies) {
  return {
    async resolveDetailedByTokenHash(
      tokenHash: string,
      now: Date,
    ): Promise<DetailedAuthContextResolution> {
      return await db.transaction(async (tx) => {
        const [candidate] = await tx
          .select({
            sessionId: sessions.id,
            sessionCreatedAt: sessions.createdAt,
            sessionExpiresAt: sessions.expiresAt,
            sessionRevokedAt: sessions.revokedAt,
            userId: users.id,
            email: users.email,
            displayName: users.displayName,
            emailVerifiedAt: users.emailVerifiedAt,
            userStatus: users.status,
            tenantId: tenants.id,
            tenantSlug: tenants.slug,
            tenantName: tenants.name,
            tenantStatus: tenants.status,
          })
          .from(sessions)
          .innerJoin(users, eq(sessions.userId, users.id))
          .innerJoin(tenants, eq(users.tenantId, tenants.id))
          .where(eq(sessions.tokenHash, tokenHash))
          .limit(1)
          .for("share", { of: [sessions, users, tenants] });

        if (candidate === undefined) {
          return toUnauthenticated("session_not_found");
        }

        if (candidate.sessionRevokedAt !== null) {
          return toUnauthenticated("session_revoked");
        }

        if (candidate.sessionExpiresAt.getTime() <= now.getTime()) {
          return toUnauthenticated("session_expired");
        }

        if (candidate.userStatus !== "active") {
          return toUnauthenticated("user_not_active");
        }

        if (candidate.tenantStatus !== "active") {
          return toUnauthenticated("tenant_not_active");
        }

        if (candidate.emailVerifiedAt === null) {
          return toUnauthenticated("email_not_verified");
        }

        const [passwordState] = await tx
          .select({
            passwordUpdatedAt: userPasswords.passwordUpdatedAt,
            resetRequired: userPasswords.resetRequired,
          })
          .from(userPasswords)
          .where(eq(userPasswords.userId, candidate.userId))
          .limit(1)
          .for("share", { of: [userPasswords] });

        if (
          passwordState === undefined ||
          passwordState.passwordUpdatedAt === null ||
          passwordState.resetRequired === null
        ) {
          return toUnauthenticated("missing_password_row");
        }

        if (passwordState.resetRequired) {
          return toUnauthenticated("password_reset_required");
        }

        if (
          candidate.sessionCreatedAt.getTime() <
          passwordState.passwordUpdatedAt.getTime()
        ) {
          return toUnauthenticated("stale_session");
        }

        const roleRows = await tx
          .select({
            key: roles.key,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, candidate.userId))
          .orderBy(asc(roles.key));

        return {
          kind: "authenticated",
          auth: {
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
              roleKeys: roleRows.map((row) => row.key),
            },
            session: {
              id: candidate.sessionId,
              expiresAt: candidate.sessionExpiresAt,
              createdAt: candidate.sessionCreatedAt,
            },
          },
        };
      });
    },
  };
}
