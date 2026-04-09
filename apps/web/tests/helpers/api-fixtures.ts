import type { CurrentSession } from "@jubilant-carnival/contracts/auth";
import type { ApiErrorEnvelope } from "@jubilant-carnival/contracts/errors";
import {
  AUTHENTICATION_REQUIRED_ERROR_CODE,
  SERVICE_NOT_READY_ERROR_CODE,
} from "@jubilant-carnival/contracts/errors";

type CurrentSessionOverrides = {
  actor?: {
    user?: Partial<CurrentSession["actor"]["user"]>;
    tenant?: Partial<CurrentSession["actor"]["tenant"]>;
    roleKeys?: CurrentSession["actor"]["roleKeys"];
  };
  session?: Partial<CurrentSession["session"]>;
};

export function createCurrentSessionResponse({
  actor,
  session,
}: CurrentSessionOverrides = {}): CurrentSession {
  return {
    actor: {
      user: {
        id: "user-123",
        email: "user@example.com",
        displayName: "Test User",
        ...actor?.user,
      },
      tenant: {
        id: "tenant-123",
        slug: "test-tenant",
        name: "Test Tenant",
        ...actor?.tenant,
      },
      roleKeys: actor?.roleKeys ?? ["affiliate", "client_admin"],
    },
    session: {
      expiresAt: "2099-05-01T00:00:00.000Z",
      ...session,
    },
  };
}

export function createApiErrorEnvelope({
  code,
  message,
  details,
}: {
  code: string;
  message: string;
  details?: unknown;
}): ApiErrorEnvelope {
  return details === undefined
    ? {
        error: {
          code,
          message,
        },
      }
    : {
        error: {
          code,
          message,
          details,
        },
      };
}

export function createAuthenticationRequiredErrorEnvelope(): ApiErrorEnvelope {
  return createApiErrorEnvelope({
    code: AUTHENTICATION_REQUIRED_ERROR_CODE,
    message: "Authentication required",
  });
}

export function createServiceNotReadyErrorEnvelope(): ApiErrorEnvelope {
  return createApiErrorEnvelope({
    code: SERVICE_NOT_READY_ERROR_CODE,
    message: "Service is not ready",
  });
}
