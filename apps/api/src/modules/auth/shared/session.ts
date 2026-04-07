import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { CookieOptions } from "express";

import type { AppEnv } from "../../../infra/env.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTH_SESSION_COOKIE_NAME = "auth_session";

type SessionManagerOptions = {
  nodeEnv: AppEnv["NODE_ENV"];
};

type IssuedSession = {
  sessionId: string;
  sessionToken: string;
  tokenHash: string;
  expiresAt: Date;
};

export type SessionManager = ReturnType<typeof createSessionManager>;

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export function readSessionTokenFromCookieHeader(
  cookieHeader: string | undefined,
  cookieName = AUTH_SESSION_COOKIE_NAME,
): string | null {
  if (cookieHeader === undefined) {
    return null;
  }

  const cookieSegments = cookieHeader.split(";");

  for (const segment of cookieSegments) {
    const trimmedSegment = segment.trim();

    if (trimmedSegment.length === 0) {
      continue;
    }

    const separatorIndex = trimmedSegment.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const name = trimmedSegment.slice(0, separatorIndex);

    if (name !== cookieName) {
      continue;
    }

    const rawValue = trimmedSegment.slice(separatorIndex + 1);

    if (rawValue.length === 0) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

export function createSessionManager({ nodeEnv }: SessionManagerOptions) {
  const sharedCookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/api",
  };

  return {
    cookieName: AUTH_SESSION_COOKIE_NAME,

    issueSession(now = new Date()): IssuedSession {
      const sessionToken = createSessionToken();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

      return {
        sessionId: randomUUID(),
        sessionToken,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt,
      };
    },

    getCookieOptions(expiresAt: Date): CookieOptions {
      return {
        ...sharedCookieOptions,
        expires: expiresAt,
      };
    },

    getClearedCookieOptions(): CookieOptions {
      return {
        ...sharedCookieOptions,
        expires: new Date(0),
      };
    },
  };
}
