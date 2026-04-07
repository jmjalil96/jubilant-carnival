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

type LoginRepositoryDependencies = {
  db: Database;
};

export type LoginCandidate = {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string | null;
  emailVerifiedAt: Date | null;
  userStatus: typeof users.$inferSelect.status;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: typeof tenants.$inferSelect.status;
  passwordHash: string | null;
  passwordUpdatedAt: Date | null;
  resetRequired: boolean | null;
};

export type CreateSessionAfterRecheckInput = {
  userId: string;
  expectedPasswordUpdatedAt: Date;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
};

export type CreateSessionAfterRecheckResult =
  | { kind: "created" }
  | { kind: "invalid_credentials" }
  | { kind: "email_not_verified" }
  | { kind: "password_reset_required" };

export type LoginRepository = ReturnType<typeof createLoginRepository>;

export function createLoginRepository({ db }: LoginRepositoryDependencies) {
  return {
    async findLoginCandidateByEmailNormalized(
      emailNormalized: string,
    ): Promise<LoginCandidate | null> {
      const [candidate] = await db
        .select({
          userId: users.id,
          tenantId: tenants.id,
          email: users.email,
          displayName: users.displayName,
          emailVerifiedAt: users.emailVerifiedAt,
          userStatus: users.status,
          tenantSlug: tenants.slug,
          tenantName: tenants.name,
          tenantStatus: tenants.status,
          passwordHash: userPasswords.passwordHash,
          passwordUpdatedAt: userPasswords.passwordUpdatedAt,
          resetRequired: userPasswords.resetRequired,
        })
        .from(users)
        .innerJoin(tenants, eq(users.tenantId, tenants.id))
        .leftJoin(userPasswords, eq(userPasswords.userId, users.id))
        .where(eq(users.emailNormalized, emailNormalized))
        .limit(1);

      return candidate ?? null;
    },

    async createSessionAfterRecheck({
      userId,
      expectedPasswordUpdatedAt,
      sessionId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    }: CreateSessionAfterRecheckInput): Promise<CreateSessionAfterRecheckResult> {
      return await db.transaction(async (tx) => {
        const [recheckedCandidate] = await tx
          .select({
            userStatus: users.status,
            emailVerifiedAt: users.emailVerifiedAt,
            tenantStatus: tenants.status,
            passwordUpdatedAt: userPasswords.passwordUpdatedAt,
            resetRequired: userPasswords.resetRequired,
          })
          .from(users)
          .innerJoin(tenants, eq(users.tenantId, tenants.id))
          .innerJoin(userPasswords, eq(userPasswords.userId, users.id))
          .where(eq(users.id, userId))
          .limit(1)
          .for("share", { of: [users, tenants, userPasswords] });

        if (
          recheckedCandidate === undefined ||
          recheckedCandidate.userStatus !== "active" ||
          recheckedCandidate.tenantStatus !== "active" ||
          recheckedCandidate.passwordUpdatedAt === null ||
          recheckedCandidate.resetRequired === null
        ) {
          return { kind: "invalid_credentials" };
        }

        if (
          recheckedCandidate.passwordUpdatedAt.getTime() !==
          expectedPasswordUpdatedAt.getTime()
        ) {
          return { kind: "invalid_credentials" };
        }

        if (recheckedCandidate.emailVerifiedAt === null) {
          return { kind: "email_not_verified" };
        }

        if (recheckedCandidate.resetRequired) {
          return { kind: "password_reset_required" };
        }

        await tx.insert(sessions).values({
          id: sessionId,
          userId,
          tokenHash,
          expiresAt,
          ...(ipAddress === undefined ? {} : { ipAddress }),
          ...(userAgent === undefined ? {} : { userAgent }),
        });

        return { kind: "created" };
      });
    },

    async listRoleKeysForUser(userId: string): Promise<string[]> {
      const rows = await db
        .select({
          key: roles.key,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, userId))
        .orderBy(asc(roles.key));

      return rows.map((row) => row.key);
    },
  };
}
