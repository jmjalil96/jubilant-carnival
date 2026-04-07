type RenderPasswordResetEmailInput = {
  resetUrl: string;
  expiresAt: Date;
};

export type RenderedPasswordResetEmail = {
  subject: string;
  text: string;
  html: string;
};

export function renderPasswordResetEmail({
  resetUrl,
  expiresAt,
}: RenderPasswordResetEmailInput): RenderedPasswordResetEmail {
  const expiresAtIso = expiresAt.toISOString();
  const subject = "Reset your password";
  const text = [
    "You requested a password reset.",
    "",
    `Reset your password: ${resetUrl}`,
    "",
    `This link expires at ${expiresAtIso}.`,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = [
    "<p>You requested a password reset.</p>",
    `<p><a href="${resetUrl}">Reset your password</a></p>`,
    `<p>This link expires at <code>${expiresAtIso}</code>.</p>`,
    "<p>If you did not request this, you can ignore this email.</p>",
  ].join("");

  return {
    subject,
    text,
    html,
  };
}
