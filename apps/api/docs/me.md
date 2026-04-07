# Current Session Endpoint Checklist

This document defines what `GET /api/v1/auth/me` should accomplish for the API.

Current assumptions:

- Endpoint: `GET /api/v1/auth/me`
- Auth source: `auth_session` cookie
- Session model: server-generated session token, stored as a hash in `sessions`
- User model: exactly one `tenant` per `user`
- Response model: same `actor` shape as login, plus `session.expiresAt`
- Auth source of truth: shared request-time auth resolver, not route-local logic

## `/me` Should Accomplish

- [x] Accept an authenticated request using the session cookie
- [x] Resolve the current authenticated actor from the session token
- [x] Confirm the session is still valid right now
- [x] Confirm the user is still allowed to access the app right now
- [x] Confirm the tenant is still allowed to access the app right now
- [x] Confirm the session is still valid after password changes
- [x] Load the actor identity needed by the frontend after app bootstrap
- [x] Load the actor's current role keys for authorization-aware UI
- [x] Return the current actor payload and session expiry
- [x] Return a generic authentication failure for missing or invalid auth
- [x] Emit internal logs for invalid auth and successful resolution when useful
- [x] Set non-cacheable response headers such as `Cache-Control: no-store`

## Business Logic Checks

### Request validation

- [x] Require the `GET` method
- [x] Ignore any request body
- [x] Read the raw `Cookie` header
- [x] Parse the `auth_session` cookie without requiring `cookie-parser`
- [x] Treat a missing session cookie as unauthenticated
- [x] Treat a malformed or undecodable session cookie as unauthenticated

### Session lookup

- [x] Hash the raw session token before lookup
- [x] Look up the session by `sessions.token_hash`
- [x] Read the current user through `sessions.user_id`
- [x] Read the current tenant through `users.tenant_id`
- [x] Read the current password state through `user_passwords.user_id`
- [x] Read the user's current roles through `user_roles` and `roles`

### Authentication gating

- [x] Return a generic authentication failure if the session does not exist
- [x] Return a generic authentication failure if `sessions.revoked_at` is non-null
- [x] Return a generic authentication failure if the session is expired
- [x] Return a generic authentication failure if the user does not exist
- [x] Return a generic authentication failure if the tenant does not exist
- [x] Return a generic authentication failure if the user has no password row
- [x] Require `users.status = active`
- [x] Require `tenants.status = active`
- [x] Require `users.email_verified_at` to be non-null
- [x] Reject access when `user_passwords.reset_required = true`
- [x] Reject access when `sessions.created_at < user_passwords.password_updated_at`
- [x] Keep invalid auth indistinguishable at the HTTP boundary
- [x] Log the real internal invalid-auth reason without returning it to the caller

### Response behavior

- [x] Return the user identity needed by the web app
- [x] Return the tenant identity needed by the web app
- [x] Return the user's current role keys
- [x] Return the session expiry
- [x] Match the `actor` response shape already used by login
- [x] Set `Cache-Control: no-store`
- [x] Set `Vary: Cookie`
- [x] Avoid rotating or extending the session in this first version

## Tables And Fields `/me` Touches

### Reads

- [x] `sessions.id`
- [x] `sessions.user_id`
- [x] `sessions.token_hash`
- [x] `sessions.expires_at`
- [x] `sessions.revoked_at`
- [x] `sessions.created_at`
- [x] `users.id`
- [x] `users.tenant_id`
- [x] `users.email`
- [x] `users.display_name`
- [x] `users.email_verified_at`
- [x] `users.status`
- [x] `tenants.id`
- [x] `tenants.slug`
- [x] `tenants.name`
- [x] `tenants.status`
- [x] `user_passwords.user_id`
- [x] `user_passwords.password_updated_at`
- [x] `user_passwords.reset_required`
- [x] `user_roles.user_id`
- [x] `user_roles.role_id`
- [ ] `roles.id`
- [x] `roles.key`

### Writes

- [x] No writes in the first version of `/me`
- [x] Leave `sessions.last_seen_at` untouched in the first version
- [x] Avoid rotating the session cookie in the first version

## Races To Avoid

### Password-change race

- [x] Reject sessions created before the most recent `user_passwords.password_updated_at`
- [x] Avoid treating login-time password freshness checks as sufficient forever
- [x] Re-check password freshness on every authenticated request, including `/me`

### User-disable race

- [x] Avoid treating login-time status checks as sufficient forever
- [x] Re-check `users.status` on `/me`
- [x] Reject sessions for users that become disabled after login

### Tenant-disable race

- [x] Avoid letting tenant deactivation be bypassed by an already-created session
- [x] Re-check `tenants.status` on `/me`
- [x] Reject sessions for users whose tenant becomes disabled

### Session-revocation race

- [x] Re-check `sessions.revoked_at` on `/me`
- [x] Re-check `sessions.expires_at` on `/me`
- [x] Accept that revocation or expiry may happen immediately after the read and only affect the next request

### User-delete race

- [x] Handle the case where the user is deleted after login but before `/me`
- [x] Treat missing user, tenant, or password rows as a generic authentication failure

### Role-change race

- [x] Prefer loading current roles fresh for authorization decisions
- [x] Avoid treating the login response as the source of truth for future requests
- [x] Accept that the `/me` response may briefly reflect stale roles if they change after the read and before the response

## Definite Security Expectations

- [x] Never trust user, tenant, role, or session identifiers from query params or the request body
- [x] Never look up a session by raw token; always hash it first
- [x] Never use the session row alone as sufficient proof of valid auth
- [x] Never return whether the session was revoked, expired, stale, disabled, or otherwise blocked
- [x] Never persist authorization claims in the cookie
- [x] Never cache `/me` in shared caches
- [x] Never make the frontend the source of truth for authentication or authorization
