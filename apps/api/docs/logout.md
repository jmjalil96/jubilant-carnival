# Logout Endpoint Checklist

This document defines what the first logout endpoint should accomplish for the API.

Current assumptions:

- Endpoint: `DELETE /api/v1/auth/session`
- Auth source: `auth_session` cookie
- Session model: server-generated session token, stored as a hash in `sessions`
- Logout scope: revoke only the current session identified by the cookie
- User model: exactly one `tenant` per `user`
- Response model: `204 No Content`
- Auth source of truth: raw cookie token plus server-side session lookup, not frontend state

## Logout Should Accomplish

- [ ] Accept a logout attempt for the current session
- [ ] Revoke the current session server-side when it exists
- [ ] Clear the session cookie from the browser
- [ ] Succeed even when the cookie is missing, malformed, unknown, expired, stale, or already revoked
- [ ] Avoid revoking any sibling sessions for the same user
- [ ] Emit internal logs for successful revocation and useful no-op cases
- [ ] Return a response the frontend can treat as terminal logout without extra branching
- [ ] Set non-cacheable response headers such as `Cache-Control: no-store`

## Business Logic Checks

### Request validation

- [ ] Require the `DELETE` method
- [ ] Ignore any request body
- [ ] Ignore any query params for identifying the session
- [ ] Read the raw `Cookie` header
- [ ] Parse the `auth_session` cookie without requiring `cookie-parser`
- [ ] Treat a missing session cookie as a logout no-op
- [ ] Treat a malformed or undecodable session cookie as a logout no-op

### Session lookup

- [ ] Hash the raw session token before lookup
- [ ] Look up the session by `sessions.token_hash`
- [ ] Target only the single current session row identified by the cookie
- [ ] Avoid looking up sessions by user-controlled IDs from params, query, or body

### Session revocation

- [ ] Set `sessions.revoked_at` when the current session exists and is not already revoked
- [ ] Update `sessions.updated_at` when revoking the session
- [ ] Leave the session row in place rather than deleting it
- [ ] Treat an already revoked session as a successful no-op
- [ ] Treat an unknown session as a successful no-op
- [ ] Treat an expired session as a successful no-op at the HTTP boundary
- [ ] Treat a stale session after password change as a successful no-op at the HTTP boundary
- [ ] Avoid requiring the user or tenant to still be active in order to log out
- [ ] Avoid requiring email verification or password freshness in order to log out
- [ ] Avoid revoking all sessions for the user in this first version

### Response behavior

- [ ] Return `204 No Content` with no response body
- [ ] Clear the `auth_session` cookie even when no matching session row exists
- [ ] Clear the cookie using the same scope as login (`path`, `httpOnly`, `sameSite`, `secure`)
- [ ] Expire the cookie immediately
- [ ] Set `Cache-Control: no-store`
- [ ] Set `Vary: Cookie`
- [ ] Preserve CORS credential support for allowed origins

## Tables And Fields Logout Touches

### Reads

- [ ] `sessions.id`
- [ ] `sessions.token_hash`
- [ ] `sessions.revoked_at`

### Writes

- [ ] `sessions.revoked_at`
- [ ] `sessions.updated_at`

### Does Not Touch In V1

- [ ] `sessions.last_seen_at`
- [ ] `sessions.expires_at`
- [ ] `users`
- [ ] `tenants`
- [ ] `user_passwords`
- [ ] `user_roles`
- [ ] `roles`

## Races To Avoid

### Protected-request race

- [ ] If logout acquires the session row lock first, make concurrent authenticated requests wait and then fail after revocation commits
- [ ] If an authenticated request resolves first, accept that logout affects the next request instead
- [ ] Avoid authenticating a protected request from a stale pre-revocation snapshot

### Duplicate-logout race

- [ ] Treat simultaneous logout requests for the same session as safe and idempotent
- [ ] Avoid surfacing whether the first or second request performed the actual write

### Login-vs-logout race

- [ ] Revoke only the session identified by the current cookie
- [ ] Avoid revoking a newly created sibling session for the same user
- [ ] Accept that a new login after logout creates a fresh independent session

### User-delete race

- [ ] Handle the case where the session row disappears because the user is deleted concurrently
- [ ] Treat a missing row after concurrent deletion as a successful no-op

## Definite Security Expectations

- [ ] Never trust user, tenant, role, or session identifiers from query params or the request body
- [ ] Never look up a session by raw token; always hash it first
- [ ] Never revoke all sessions implicitly when only current-session logout was requested
- [ ] Never leak whether the session was missing, revoked, expired, stale, disabled, or otherwise invalid
- [ ] Never require the frontend to distinguish among logout no-op cases
- [ ] Never leave the cookie uncleared after a logout response
- [ ] Never make the frontend the source of truth for session invalidation
