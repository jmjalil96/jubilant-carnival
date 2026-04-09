# `@jubilant-carnival/contracts`

Internal workspace package for shared HTTP transport contracts.

Scope:

- Zod schemas for shared request and response payloads
- inferred TypeScript types from those schemas
- shared field constraints
- shared transport error-code constants

Non-goals:

- runtime business logic
- backend-only internals
- env schemas
- database types
- cookie names
- route paths
- response-building helpers

If behavior belongs to one app, keep it in that app. If it defines a wire contract shared across apps, it belongs here.
