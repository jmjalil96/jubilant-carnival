import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../../../infra/db.js";
import { sessions } from "../../../infra/schema.js";

type LogoutRepositoryDependencies = {
  db: Database;
};

export type RevokeSessionByTokenHashResult =
  | {
      kind: "revoked";
      sessionId: string;
    }
  | {
      kind: "already_revoked";
      sessionId: string;
    }
  | {
      kind: "not_found";
    };

export type LogoutRepository = ReturnType<typeof createLogoutRepository>;

export function createLogoutRepository({ db }: LogoutRepositoryDependencies) {
  return {
    async revokeSessionByTokenHash(
      tokenHash: string,
      now: Date,
    ): Promise<RevokeSessionByTokenHashResult> {
      return await db.transaction(async (tx) => {
        const [session] = await tx
          .select({
            id: sessions.id,
            revokedAt: sessions.revokedAt,
          })
          .from(sessions)
          .where(eq(sessions.tokenHash, tokenHash))
          .limit(1)
          .for("update", { of: [sessions] });

        if (session === undefined) {
          return { kind: "not_found" };
        }

        if (session.revokedAt !== null) {
          return {
            kind: "already_revoked",
            sessionId: session.id,
          };
        }

        await tx
          .update(sessions)
          .set({
            revokedAt: now,
            updatedAt: now,
          })
          .where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt)));

        return {
          kind: "revoked",
          sessionId: session.id,
        };
      });
    },
  };
}
