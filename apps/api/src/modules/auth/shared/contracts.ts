import type { Actor, CurrentSession } from "@jubilant-carnival/contracts/auth";

export type { Actor };

export type AuthenticatedRequestContext = {
  actor: Actor;
  session: {
    id: string;
    expiresAt: Date;
    createdAt: Date;
  };
};

export function toCurrentSessionResponse({
  actor,
  expiresAt,
}: {
  actor: Actor;
  expiresAt: Date;
}): CurrentSession {
  return {
    actor,
    session: {
      expiresAt: expiresAt.toISOString(),
    },
  };
}
