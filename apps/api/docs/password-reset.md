# Password Reset Endpoints Checklist

This document defines what the first forgot-password flow should accomplish for the API.

Current assumptions:

- Request endpoint: `POST /api/v1/auth/password-reset`
- Confirm endpoint: `POST /api/v1/auth/password-reset/confirm`
- Reset token model: server-generated reset token, stored only as a hash in `user_tokens`
- Token kind: `user_tokens.kind = password_reset`
- Delivery model: password reset email is sent after the DB transaction commits
- User model: exactly one `tenant` per `user`
- Response model: generic `204 No Content` for reset request success, `204 No Content` for confirm success
- Auth source of truth: server-side token lookup plus current password state, not frontend state

## Password Reset Should Accomplish

- [ ] Accept a forgot-password request with an email address
- [ ] Normalize the email before lookup
- [ ] Avoid leaking whether the email exists or whether the account is eligible
- [ ] Issue a durable one-time reset token for eligible accounts
- [ ] Send the password reset email outside the DB transaction
- [ ] Accept a reset confirmation with the raw token and a new password
- [ ] Confirm the token is still valid right now
- [ ] Update the stored password only after all reset checks pass
- [ ] Clear `user_passwords.reset_required` after a successful reset
- [ ] Make older sessions fail on future authenticated requests after the password changes
- [ ] Consume the reset token so it cannot be reused
- [ ] Return responses the frontend can handle without account-enumeration branching
- [ ] Emit internal logs for request no-op cases, successful issuance, successful confirm, and blocked confirm attempts
- [ ] Apply abuse protection such as rate limiting and repeated-request tracking

## Business Logic Checks

### Reset request validation

- [ ] Require a JSON body
- [ ] Require `email` as a string
- [ ] Trim surrounding whitespace from `email`
- [ ] Reject empty `email`
- [ ] Clamp or reject unreasonable input lengths before deeper processing

### Reset request identity lookup

- [ ] Lowercase and normalize the email into `email_normalized`
- [ ] Look up the user by `users.email_normalized`
- [ ] Read the user's tenant through `users.tenant_id`
- [ ] Read the user's password record through `user_passwords.user_id`

### Reset request gating

- [ ] Return the same HTTP success response if the user does not exist
- [ ] Return the same HTTP success response if the user has no password row
- [ ] Return the same HTTP success response if `users.status` is not `active`
- [ ] Return the same HTTP success response if `tenants.status` is not `active`
- [ ] Return the same HTTP success response if `users.email_verified_at` is null
- [ ] Avoid setting `user_passwords.reset_required = true` merely because a reset was requested
- [ ] Decide explicitly whether only the newest outstanding reset token should remain valid
- [ ] If newest-token-wins is chosen, invalidate older unconsumed `password_reset` tokens in the same transaction

### Reset token issuance

- [ ] Generate a high-entropy raw reset token
- [ ] Hash the raw token before storing it
- [ ] Create a new `user_tokens` row only after all request-side checks pass
- [ ] Set `user_tokens.user_id`
- [ ] Set `user_tokens.kind = password_reset`
- [ ] Set `user_tokens.token_hash`
- [ ] Set `user_tokens.expires_at`
- [ ] Leave `user_tokens.consumed_at` as `null`
- [ ] Let the DB default populate `created_at`
- [ ] Send the raw token by email only after the transaction commits successfully
- [ ] Avoid sending email at all for ineligible or unknown accounts

### Reset confirm validation

- [ ] Require a JSON body
- [ ] Require `token` as a string
- [ ] Require `password` as a string
- [ ] Reject empty `token`
- [ ] Reject empty `password`
- [ ] Clamp or reject unreasonable token and password lengths before deeper processing
- [ ] Avoid trimming or normalizing the reset token in a way that changes its meaning

### Reset confirm token lookup

- [ ] Hash the raw token before lookup
- [ ] Look up the token by `user_tokens.token_hash`
- [ ] Require `user_tokens.kind = password_reset`
- [ ] Require `user_tokens.consumed_at` to be `null`
- [ ] Require `user_tokens.expires_at > now`
- [ ] Read the current user through `user_tokens.user_id`
- [ ] Read the current tenant through `users.tenant_id`
- [ ] Read the current password row through `user_passwords.user_id`

### Reset confirm gating

- [ ] Return one generic token failure if the token does not exist
- [ ] Return one generic token failure if the token is already consumed
- [ ] Return one generic token failure if the token is expired
- [ ] Return one generic token failure if the user no longer exists
- [ ] Return one generic token failure if the tenant no longer exists
- [ ] Return one generic token failure if the user has no password row
- [ ] Require `users.status = active`
- [ ] Require `tenants.status = active`
- [ ] Require `users.email_verified_at` to remain non-null
- [ ] Keep blocked confirm states indistinguishable at the HTTP boundary
- [ ] Log the real internal failure reason without returning it to the caller

### Password update and token consumption

- [ ] Hash the new password with the same password-hash policy used elsewhere in auth
- [ ] Update `user_passwords.password_hash`
- [ ] Update `user_passwords.password_updated_at`
- [ ] Set `user_passwords.reset_required = false`
- [ ] Update `user_passwords.updated_at`
- [ ] Set `user_tokens.consumed_at` in the same transaction
- [ ] Avoid auto-logging the user in during the confirm step
- [ ] Avoid trusting any user identifier from query params or the request body
- [ ] Rely on password freshness checks to make pre-reset sessions fail on future authenticated requests
- [ ] Decide explicitly whether to also revoke all existing sessions immediately in this first version

### Response behavior

- [ ] Return `204 No Content` for reset request success with no response body
- [ ] Return `204 No Content` for reset confirm success with no response body
- [ ] Return a generic `400` token error for invalid, consumed, expired, or otherwise unusable reset tokens
- [ ] Set `Cache-Control: no-store` on both endpoints
- [ ] Preserve CORS behavior already configured at the app layer
- [ ] Avoid setting or clearing the `auth_session` cookie in the forgot-password flow

## Tables And Fields Password Reset Touches

### Reads

- [ ] `users.id`
- [ ] `users.tenant_id`
- [ ] `users.email`
- [ ] `users.email_normalized`
- [ ] `users.email_verified_at`
- [ ] `users.status`
- [ ] `tenants.id`
- [ ] `tenants.status`
- [ ] `user_passwords.user_id`
- [ ] `user_passwords.password_hash`
- [ ] `user_passwords.password_updated_at`
- [ ] `user_passwords.reset_required`
- [ ] `user_tokens.id`
- [ ] `user_tokens.user_id`
- [ ] `user_tokens.kind`
- [ ] `user_tokens.token_hash`
- [ ] `user_tokens.expires_at`
- [ ] `user_tokens.consumed_at`

### Writes

- [ ] `user_tokens.id`
- [ ] `user_tokens.user_id`
- [ ] `user_tokens.kind`
- [ ] `user_tokens.token_hash`
- [ ] `user_tokens.expires_at`
- [ ] `user_tokens.consumed_at` when consuming a token
- [ ] `user_passwords.password_hash`
- [ ] `user_passwords.password_updated_at`
- [ ] `user_passwords.reset_required`
- [ ] `user_passwords.updated_at`

### Does Not Need To Touch In V1

- [ ] `user_roles`
- [ ] `roles`
- [ ] `sessions.last_seen_at`
- [ ] Session cookies

## Races To Avoid

### Duplicate-request race

- [ ] Decide explicitly whether multiple active `password_reset` tokens may coexist for one user
- [ ] If newest-token-wins is chosen, invalidate older unconsumed reset tokens in the same transaction as issuance
- [ ] Avoid sending a new email for a request that later rolls back

### Duplicate-confirm race

- [ ] Lock the matching `user_tokens` row with `FOR UPDATE`
- [ ] Let only one confirm request consume the token successfully
- [ ] Make the loser fail with the same generic invalid-token response

### Password-change race

- [ ] Update `user_passwords.password_updated_at` in the same transaction as token consumption
- [ ] Avoid accepting a token confirm based on a stale pre-disable or pre-delete snapshot
- [ ] Rely on authenticated request-time password freshness checks so old sessions fail after commit

### Login-vs-reset race

- [ ] If reset confirm commits first, make login re-checks observe the new password state and reject the old password
- [ ] If login acquires its locks first, accept that the in-flight login may succeed and the next authenticated request must fail as stale after reset commit

### Protected-request race

- [ ] If reset confirm acquires the password-row lock first, make protected requests wait and then fail after commit
- [ ] If protected auth resolves first, accept that the in-flight request may succeed and the next request must fail
- [ ] Avoid authenticating from a stale pre-reset snapshot

### User-disable-or-delete race

- [ ] Re-check `users`, `tenants`, and `user_passwords` inside the confirm transaction
- [ ] Treat missing or blocked rows during confirm as one generic invalid-token response

### Email-delivery race

- [ ] Send the email only after the reset-token transaction commits
- [ ] Accept that email delivery can fail after commit in the pragmatic first version
- [ ] Log post-commit delivery failures clearly because there is no outbox or retry queue in the first version

## Definite Security Expectations

- [ ] Never store raw reset tokens in the database
- [ ] Never log raw reset tokens
- [ ] Never return whether the email exists, whether the user is disabled, or whether the tenant is disabled
- [ ] Never allow a reset token to be used more than once
- [ ] Never send the reset email before the DB transaction commits
- [ ] Never trust user, tenant, or token identifiers from query params
- [ ] Never use forgot-password as an implicit account-verification or invitation flow
- [ ] Never auto-create an authenticated session as part of password reset confirm
- [ ] Never make the frontend the source of truth for token validity or password-reset completion
