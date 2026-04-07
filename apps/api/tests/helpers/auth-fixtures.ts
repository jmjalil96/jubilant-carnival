import { randomUUID } from "node:crypto";

import argon2 from "argon2";
import { eq } from "drizzle-orm";

import type { Database } from "../../src/infra/db.js";
import {
  roles,
  sessions,
  tenants,
  userPasswords,
  userRoles,
  users,
} from "../../src/infra/schema.js";
import { hashSessionToken } from "../../src/modules/auth/shared/session.js";

type SeedLoginUserFixtureOptions = {
  db: Database;
  email?: string;
  password?: string;
  displayName?: string | null;
  emailVerifiedAt?: Date | null;
  includePasswordRow?: boolean;
  resetRequired?: boolean;
  roleKeys?: string[];
  tenantStatus?: typeof tenants.$inferSelect.status;
  userStatus?: typeof users.$inferSelect.status;
};

type SeededLoginUserFixture = {
  tenantId: string;
  userId: string;
  email: string;
  password: string;
  roleKeys: string[];
};

type CreateSessionFixtureOptions = {
  db: Database;
  userId: string;
  sessionToken?: string;
  expiresAt?: Date;
  revokedAt?: Date | null;
  createdAt?: Date;
};

type SeededSessionFixture = {
  sessionId: string;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
};

async function findOrCreateRole(
  db: Database,
  roleKey: string,
): Promise<string> {
  const [existingRole] = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(eq(roles.key, roleKey))
    .limit(1);

  if (existingRole !== undefined) {
    return existingRole.id;
  }

  const roleId = randomUUID();

  await db.insert(roles).values({
    id: roleId,
    key: roleKey,
    name: roleKey,
  });

  return roleId;
}

export async function seedLoginUserFixture({
  db,
  email = `${randomUUID()}@example.com`,
  password = "super-secret-password",
  displayName = "Test User",
  emailVerifiedAt = new Date("2026-01-01T00:00:00.000Z"),
  includePasswordRow = true,
  resetRequired = false,
  roleKeys = ["client_admin"],
  tenantStatus = "active",
  userStatus = "active",
}: SeedLoginUserFixtureOptions): Promise<SeededLoginUserFixture> {
  const tenantId = randomUUID();
  const userId = randomUUID();

  await db.insert(tenants).values({
    id: tenantId,
    slug: `tenant-${randomUUID()}`,
    name: "Test Tenant",
    status: tenantStatus,
  });

  await db.insert(users).values({
    id: userId,
    tenantId,
    email,
    emailNormalized: email.trim().toLowerCase(),
    displayName,
    emailVerifiedAt,
    status: userStatus,
  });

  if (includePasswordRow) {
    await db.insert(userPasswords).values({
      userId,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      resetRequired,
    });
  }

  for (const roleKey of roleKeys) {
    const roleId = await findOrCreateRole(db, roleKey);

    await db.insert(userRoles).values({
      userId,
      roleId,
    });
  }

  return {
    tenantId,
    userId,
    email,
    password,
    roleKeys,
  };
}

export async function createSessionFixture({
  db,
  userId,
  sessionToken = randomUUID(),
  expiresAt = new Date("2026-02-01T00:00:00.000Z"),
  revokedAt,
  createdAt = new Date("2026-01-01T00:00:00.000Z"),
}: CreateSessionFixtureOptions): Promise<SeededSessionFixture> {
  const sessionId = randomUUID();

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
    ...(revokedAt === undefined ? {} : { revokedAt }),
    createdAt,
  });

  return {
    sessionId,
    sessionToken,
    expiresAt,
    createdAt,
  };
}
