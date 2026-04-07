# SMTP Email Service Plan

This directory should hold the pragmatic first email transport for the API.

## Goal

Use Nodemailer over SMTP to send password reset emails after the password-reset token transaction commits. Keep the first version small, testable, and explicit about its tradeoffs.

## Non-Goals

- No background queue in the first version
- No outbox table in the first version
- No template engine dependency in the first version
- No provider abstraction beyond a thin local interface
- No retry daemon in the first version

## Why Send Outside The Transaction

- SMTP is network I/O and should not extend database lock duration.
- A DB rollback cannot unsend an email.
- If the transaction fails, no email should be sent.
- The natural flow is: persist token -> commit -> send email.

## Proposed Files

- `apps/api/src/infra/email/contracts.ts`
  - Small interface for sending email and the password-reset message input.
- `apps/api/src/infra/email/nodemailer.ts`
  - Nodemailer-backed implementation and transport construction.
- `apps/api/src/infra/email/templates/password-reset.ts`
  - Small helper that returns the subject, text body, and HTML body for the reset email.
- `apps/api/src/infra/email/index.ts`
  - Re-export the public factory and types.

## Proposed Public Shape

```ts
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
```

Keep this interface narrow. The auth module should depend on `EmailService`, not on Nodemailer directly.

## Environment Additions

Add these later in `apps/api/src/infra/env.ts` when the service is implemented:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO` optional
- `APP_BASE_URL`

Pragmatic defaults:

- `SMTP_SECURE = true` for port `465`
- `SMTP_SECURE = false` for ports like `587`
- `APP_BASE_URL` is used to build the password-reset link shown to the user

## Nodemailer Construction Plan

- Create one transport at process startup, not per request.
- Use SMTP auth from env.
- Keep `from` centralized in the service config.
- Optionally call `transport.verify()` on startup in non-test environments if you want fail-fast behavior.
- In tests, inject a fake `EmailService` instead of using real SMTP.

Example implementation shape:

```ts
type CreateEmailServiceDependencies = {
  logger: Logger;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  from: string;
  replyTo?: string | undefined;
};

export function createEmailService(
  deps: CreateEmailServiceDependencies,
): EmailService {
  const transport = nodemailer.createTransport({
    host: deps.smtpHost,
    port: deps.smtpPort,
    secure: deps.smtpSecure,
    auth: {
      user: deps.smtpUsername,
      pass: deps.smtpPassword,
    },
  });

  return {
    async send({ to, subject, text, html }) {
      await transport.sendMail({
        from: deps.from,
        replyTo: deps.replyTo,
        to,
        subject,
        text,
        ...(html === undefined ? {} : { html }),
      });
    },

    async sendPasswordReset({ to, resetUrl, expiresAt }) {
      const message = renderPasswordResetEmail({ resetUrl, expiresAt });

      await this.send({
        to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}
```

## Password Reset Flow Integration

The reset-request service should follow this order:

1. Normalize email and perform the request-side gating.
2. Open a DB transaction.
3. Insert the new `user_tokens` row and invalidate older reset tokens if that policy is chosen.
4. Commit the transaction.
5. After commit, call `emailService.sendPasswordReset(...)`.
6. Return the same generic HTTP success response regardless of whether an email was actually sent.

The raw reset token should exist only in service memory long enough to build the reset URL and send the email. Only the hash belongs in the database.

## Failure Model

Pragmatic first version:

- If token issuance fails, do not send email.
- If DB commit succeeds and SMTP send fails, log the failure and keep the HTTP response generic.
- Do not try to roll back the committed token because the transaction is already complete.
- Accept that a token may exist without a delivered email in the first version.

This is acceptable for v1, but it is the main reason to consider an outbox later.

## Logging Expectations

- Log successful SMTP sends at `info` only if that volume is acceptable.
- Log SMTP failures at `error` with the recipient email and message type.
- Never log the raw reset token or full reset URL.
- Prefer structured log fields such as `messageType: "password_reset"` and `userId` when available.

## Testing Plan

- Unit-test the password-reset service with a fake `EmailService`.
- Integration-test that the auth service attempts to send email only after a successful token transaction.
- Add one failure-path test where the DB write succeeds and the email sender throws; confirm the route still returns the generic success response and the token row remains committed.
- Keep SMTP out of normal test runs.

## Future Upgrade Path

When the pragmatic SMTP service becomes a bottleneck, evolve in this order:

1. Add an outbox table and write email jobs in the same transaction as token issuance.
2. Move actual delivery to a worker.
3. Add retries, dead-letter handling, and provider failover deliberately.

Do not add that complexity before the reset flow exists and the basic delivery contract is proven.
