import argon2 from "argon2";

export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
  });
}

export async function verifyPasswordHash(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return await argon2.verify(passwordHash, password);
}
