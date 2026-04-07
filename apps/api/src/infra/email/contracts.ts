export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string | undefined;
};

export type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresAt: Date;
};

export interface EmailService {
  send(input: SendEmailInput): Promise<void>;
  sendPasswordReset(input: PasswordResetEmailInput): Promise<void>;
}
