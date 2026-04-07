export type Actor = {
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  roleKeys: string[];
};

export type AuthenticatedRequestContext = {
  actor: Actor;
  session: {
    id: string;
    expiresAt: Date;
    createdAt: Date;
  };
};

export type CurrentSessionResponse = {
  actor: Actor;
  session: {
    expiresAt: string;
  };
};

export function toCurrentSessionResponse({
  actor,
  expiresAt,
}: {
  actor: Actor;
  expiresAt: Date;
}): CurrentSessionResponse {
  return {
    actor,
    session: {
      expiresAt: expiresAt.toISOString(),
    },
  };
}
