import { createHash, randomBytes, randomUUID } from "node:crypto";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

type IssuedPasswordResetToken = {
  tokenId: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

function createPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issuePasswordResetToken(
  now = new Date(),
): IssuedPasswordResetToken {
  const token = createPasswordResetToken();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

  return {
    tokenId: randomUUID(),
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt,
  };
}
