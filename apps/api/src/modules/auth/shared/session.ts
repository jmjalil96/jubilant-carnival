import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { CookieOptions } from "express";

import type { AppEnv } from "../../../infra/env.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export function createSessionManager({ nodeEnv }: SessionManagerOptions) {
  return {
    cookieName: "auth_session",

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
        httpOnly: true,
        sameSite: "lax",
        secure: nodeEnv === "production",
        path: "/api",
        expires: expiresAt,
      };
    },
  };
}
