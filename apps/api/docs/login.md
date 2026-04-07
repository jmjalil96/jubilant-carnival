# Login Endpoint Checklist

This document defines what the first login endpoint should accomplish for the API.

Current assumptions:

- Endpoint: `POST /api/v1/auth/session`
- Login identity: global `email + password`
- Session model: server-generated session token, stored as a hash in `sessions`
- User model: exactly one `tenant` per `user`

## Login Should Accomplish

- [x] Accept a login attempt with `email` and `password`
- [x] Normalize the email before lookup
- [x] Authenticate the caller without leaking whether the email exists
- [x] Confirm the user is allowed to sign in right now
- [x] Confirm the tenant is allowed to sign in right now
- [x] Load the actor identity needed by the frontend after login
- [x] Load the actor's role keys for immediate authorization-aware UI
- [x] Create a durable server-side session record
- [x] Set a secure session cookie containing the raw session token
- [x] Return the authenticated actor payload and session expiry
- [x] Emit internal logs for success and failure
- [ ] Apply abuse protection such as rate limiting and repeated-failure tracking

## Business Logic Checks

### Request validation

- [x] Require a JSON body
- [x] Require `email` as a string
- [x] Require `password` as a string
- [x] Trim surrounding whitespace from `email`
- [x] Reject empty `email`
- [x] Reject empty `password`
- [x] Clamp or reject unreasonable input lengths before deeper processing

### Identity lookup

- [x] Lowercase and normalize the email into `email_normalized`
- [x] Look up the user by `users.email_normalized`
- [x] Read the user's tenant through `users.tenant_id`
- [x] Read the user's password record through `user_passwords.user_id`
- [x] Read the user's roles through `user_roles` and `roles`

### Authentication gating

- [x] Return a generic authentication failure if the user does not exist
- [x] Return a generic authentication failure if the user has no password row
- [x] Return a generic authentication failure if the password hash is invalid
- [x] Require `users.status = active`
- [x] Require `tenants.status = active`
- [x] Require `users.email_verified_at` to be non-null
- [x] Block normal login when `user_passwords.reset_required = true`
- [x] Verify the password hash with a constant-time password verification function
- [x] Keep generic credential failures indistinguishable at the HTTP boundary while returning explicit blocked-state codes for verified-password cases
- [x] Log the real internal failure reason without returning it to the caller

### Session creation

- [x] Generate a high-entropy raw session token
- [x] Hash the raw token before storing it
- [x] Create a new `sessions` row only after all auth checks pass
- [x] Set `sessions.user_id`
- [x] Set `sessions.token_hash`
- [x] Set `sessions.expires_at`
- [x] Optionally set `sessions.ip_address`
- [x] Optionally set `sessions.user_agent`
- [x] Leave `sessions.revoked_at` as `null`
- [x] Let DB defaults populate `created_at` and `updated_at`

### Response behavior

- [x] Set the session cookie as `httpOnly`
- [x] Set `secure` in production
- [x] Set an explicit `sameSite` policy
- [x] Set a clear cookie lifetime aligned with `sessions.expires_at`
- [x] Return the user identity needed by the web app
- [x] Return the tenant identity needed by the web app
- [x] Return the user's role keys
- [x] Return the session expiry

## Tables And Fields Login Touches

### Reads

- [x] `users.id`
- [x] `users.tenant_id`
- [x] `users.email`
- [x] `users.email_normalized`
- [x] `users.display_name`
- [x] `users.email_verified_at`
- [x] `users.status`
- [x] `tenants.id`
- [x] `tenants.slug`
- [x] `tenants.name`
- [x] `tenants.status`
- [x] `user_passwords.user_id`
- [x] `user_passwords.password_hash`
- [x] `user_passwords.password_updated_at`
- [x] `user_passwords.reset_required`
- [x] `user_roles.user_id`
- [x] `user_roles.role_id`
- [x] `roles.id`
- [x] `roles.key`
- [ ] `roles.name`

### Writes

- [x] `sessions.id`
- [x] `sessions.user_id`
- [x] `sessions.token_hash`
- [x] `sessions.expires_at`
- [x] `sessions.ip_address` when available
- [x] `sessions.user_agent` when available
- [x] Leave `sessions.last_seen_at` as `null` on creation because this implementation does not set it

## Races To Avoid

### Password-change race

- [ ] Avoid accepting a session created from an old password just before the password changes
- [ ] Invalidate sessions when `sessions.created_at < user_passwords.password_updated_at`
- [x] Re-check password freshness inside a short transaction before inserting the session if stricter guarantees are needed

### User-disable race

- [ ] Avoid treating login-time status checks as sufficient forever
- [ ] Re-check `users.status` on authenticated requests, not only at login
- [ ] Reject or revoke sessions for users that become disabled after login

### Tenant-disable race

- [ ] Avoid letting tenant deactivation be bypassed by an already-created session
- [ ] Re-check `tenants.status` on authenticated requests, not only at login
- [ ] Reject or revoke sessions for users whose tenant becomes disabled

### User-delete race

- [x] Handle the case where the user is deleted between the auth read and the session insert
- [x] Treat session insert FK failures as a generic authentication failure for the request

### Session-token race

- [x] Avoid relying on token randomness alone
- [x] Keep the unique constraint on `sessions.token_hash`
- [x] Retry token generation once if the insert conflicts on `token_hash`

### Role-change race

- [x] Avoid persisting role claims inside the session as the source of truth
- [ ] Prefer loading current roles fresh for authorization decisions
- [x] Accept that the login response may briefly reflect stale role data if roles change concurrently

### Concurrent-login behavior

- [x] Decide explicitly whether multiple concurrent sessions are allowed
- [x] If they are allowed, treat simultaneous successful logins as normal
- [ ] If they are not allowed later, add revocation or session replacement rules deliberately rather than implicitly

## Definite Security Expectations

- [x] Never store raw passwords
- [x] Never store raw session tokens in the database
- [x] Never return whether the email exists, whether the password row exists, or whether the user is disabled
- [x] Never create a session before password verification and status checks complete
- [x] Never trust tenant, role, or user identifiers from the request body
- [x] Never make the frontend the source of truth for authentication or authorization
