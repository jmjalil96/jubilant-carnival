import nodemailer, { type Transporter } from "nodemailer";

import type {
  EmailService,
  PasswordResetEmailInput,
  SendEmailInput,
} from "./contracts.js";
import { renderPasswordResetEmail } from "./templates/password-reset.js";

type CreateSmtpEmailServiceDependencies = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  from: string;
  replyTo?: string | undefined;
};

export function createSmtpEmailService({
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUsername,
  smtpPassword,
  from,
  replyTo,
}: CreateSmtpEmailServiceDependencies): EmailService {
  const transport: Transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUsername,
      pass: smtpPassword,
    },
  });

  async function send({
    to,
    subject,
    text,
    html,
  }: SendEmailInput): Promise<void> {
    await transport.sendMail({
      from,
      replyTo,
      to,
      subject,
      text,
      ...(html === undefined ? {} : { html }),
    });
  }

  return {
    send,

    async sendPasswordReset({
      to,
      resetUrl,
      expiresAt,
    }: PasswordResetEmailInput): Promise<void> {
      const message = renderPasswordResetEmail({
        resetUrl,
        expiresAt,
      });

      await send({
        to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}
