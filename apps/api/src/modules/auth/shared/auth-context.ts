import type { AuthenticatedRequestContext } from "./contracts.js";
import type { AuthContextRepository } from "./auth-context-repository.js";
import {
  hashSessionToken,
  readSessionTokenFromCookieHeader,
} from "./session.js";

type AuthContextResolverDependencies = {
  repository: AuthContextRepository;
};

export type InvalidAuthReason =
  | "missing_session_cookie"
  | "session_not_found"
  | "session_revoked"
  | "session_expired"
  | "missing_password_row"
  | "user_not_active"
  | "tenant_not_active"
  | "email_not_verified"
  | "password_reset_required"
  | "stale_session";

export type DetailedAuthContextResolution =
  | {
      kind: "authenticated";
      auth: AuthenticatedRequestContext;
    }
  | {
      kind: "unauthenticated";
      reason: InvalidAuthReason;
    };

export type AuthContextResolver = ReturnType<typeof createAuthContextResolver>;

export function createAuthContextResolver({
  repository,
}: AuthContextResolverDependencies) {
  async function resolveDetailedFromSessionToken(
    sessionToken: string | null | undefined,
    now = new Date(),
  ): Promise<DetailedAuthContextResolution> {
    if (
      sessionToken === undefined ||
      sessionToken === null ||
      sessionToken.length === 0
    ) {
      return {
        kind: "unauthenticated",
        reason: "missing_session_cookie",
      };
    }

    return await repository.resolveDetailedByTokenHash(
      hashSessionToken(sessionToken),
      now,
    );
  }

  async function resolveDetailedFromCookieHeader(
    cookieHeader: string | undefined,
    now = new Date(),
  ): Promise<DetailedAuthContextResolution> {
    return await resolveDetailedFromSessionToken(
      readSessionTokenFromCookieHeader(cookieHeader),
      now,
    );
  }

  return {
    resolveDetailedFromCookieHeader,
    resolveDetailedFromSessionToken,
    async resolveFromCookieHeader(
      cookieHeader: string | undefined,
      now = new Date(),
    ): Promise<AuthenticatedRequestContext | null> {
      const result = await resolveDetailedFromCookieHeader(cookieHeader, now);

      return result.kind === "authenticated" ? result.auth : null;
    },
    async resolveFromSessionToken(
      sessionToken: string | null | undefined,
      now = new Date(),
    ): Promise<AuthenticatedRequestContext | null> {
      const result = await resolveDetailedFromSessionToken(sessionToken, now);

      return result.kind === "authenticated" ? result.auth : null;
    },
  };
}
