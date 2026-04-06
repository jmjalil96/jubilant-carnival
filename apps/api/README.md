# `@jubilant-carnival/api`

This package is the backend service in the monorepo. It is an Express API written in strict TypeScript, with Zod for runtime validation, Drizzle ORM for database access, PostgreSQL as the backing store, and Vitest for integration testing.

Use the [root README](../../README.md) for monorepo-wide workflows and shared config. Use this document for package architecture, contributor rules, and package-specific commands.

## Purpose and Entrypoints

The package has two main startup layers:

- `src/bootstrap.ts`
  - Loads `.env` from the package directory.
  - Defers importing the server until environment loading has happened.
  - Exists to keep bootstrapping concerns out of the server composition code.
- `src/server.ts`
  - Loads validated environment values from `infra/env.ts`.
  - Creates the logger, HTTP logger, database client, and readiness dependency.
  - Builds the Express app and starts listening.
  - Owns process lifecycle behavior such as graceful shutdown on `SIGINT` and `SIGTERM`.

The Express application is mounted under `/api/v1`.

## Directory Map

```text
apps/api
├── src/
│   ├── bootstrap.ts
│   ├── server.ts
│   ├── http/          # Express composition, routing, validation, errors
│   ├── infra/         # Environment, logging, database, schema adapters
│   └── modules/       # Feature and domain behavior
├── tests/
│   ├── helpers/       # Test-only app, process, DB, and polling helpers
│   └── integration/   # HTTP, process, and DB-backed integration tests
├── drizzle/           # Generated SQL and migration metadata
├── compose.yml        # Local PostgreSQL container
├── drizzle.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.typecheck.json
└── package.json
```

How to read the structure:

- `src/http` is the transport layer.
- `src/infra` is the adapter layer for process, environment, logging, and database setup.
- `src/modules` is where feature behavior should live.
- `tests/helpers` provides reusable test infrastructure.
- `drizzle/` is generated output. Treat it as migration state, not hand-written application logic.

## How To Use `src/http`

The `http` folder should stay thin. Its job is to accept HTTP requests, validate them, delegate to feature code, and normalize responses.

### `app.ts`

Use `app.ts` only to compose the Express app:

- register cross-cutting middleware
- register top-level route mounts
- register the shared not-found handler
- register the shared error handler

Do not put feature endpoint logic directly in `app.ts`. If you are adding a new feature area, create or extend a router and mount it through the API router.

### `router.ts`

Use `router.ts` as the API aggregation layer:

- mount feature routers here
- keep the top-level `/api/v1` structure easy to scan
- inject feature dependencies here if the module needs them

Do not add business logic directly in `router.ts`. Its job is to assemble routers, not to implement behavior.

### `validation.ts`

Use `validatedRoute` when a route needs typed and validated request input.

This is the standard path for:

- parsing route params
- parsing query strings
- parsing request bodies
- converting Zod failures into the shared `validation_error` response shape

Prefer this helper over ad hoc `schema.parse` calls scattered through route handlers. It keeps request parsing consistent and centralizes the error shape.

### `errors.ts`

Use `AppError` for expected failures that should become structured HTTP errors.

Use `toErrorResponse` to keep the JSON error envelope consistent:

```json
{
  "error": {
    "code": "some_error_code",
    "message": "Human-readable message"
  }
}
```

Add optional `details` only when they help a caller or a contributor debug a problem.

### `error-handler.ts`

This file is the only place that should translate thrown values into final HTTP error responses.

Current responsibilities include:

- converting malformed JSON into `invalid_json`
- converting oversized payloads into `payload_too_large`
- converting `AppError` into its declared status and response envelope
- logging unexpected errors and returning `internal_server_error`

Do not duplicate this translation logic inside route handlers.

### `not-found.ts`

Use the shared not-found handler so unknown routes return the same error envelope as other failures. Do not inline ad hoc 404 JSON responses in feature routers.

## How To Use `src/infra`

The `infra` folder owns boundary concerns. It should create adapters and validated configuration, then hand those dependencies into the rest of the app.

### `env.ts`

`env.ts` is the single source of truth for runtime configuration.

Use it for:

- defining required environment variables
- defining defaults
- validating formats
- parsing environment input into strongly typed configuration

If you add a new environment variable:

1. add it to the schema in `env.ts`
2. decide whether it has a default
3. expose it through the parsed app env type
4. add it to `.env.example`

Do not read raw `process.env` values throughout the app. Parse once at the edge and pass typed values inward.

### `db.ts`

`db.ts` owns database client construction.

Use it to:

- create the shared PostgreSQL pool
- create the Drizzle database instance
- return both so process edges can manage lifecycle cleanly

Create database clients at process boundaries, such as `server.ts`, and pass them into modules. Do not create new pools deep inside feature code.

### `logger.ts`

`logger.ts` owns application logging setup.

Use it to:

- create the base Pino logger
- create the request logger middleware
- keep environment-aware logging behavior in one place

Do not instantiate ad hoc Pino loggers in random modules unless there is a specific need that the shared logger cannot satisfy.

### `schema.ts`

`schema.ts` defines Drizzle schema objects used by the application and the migration workflow. Keep schema definitions here and keep migration generation aligned with them through the package DB commands.

## Feature And Module Guidance

Business behavior belongs in `src/modules/*`.

The intended layering is:

- `infra` creates adapters and validated config
- `http` accepts requests and shapes HTTP responses
- `modules` implement feature behavior

Current code includes a `system` module for health and readiness behavior. Treat that as the pattern for future feature areas:

- add a module directory
- keep transport code thin
- keep core behavior out of `http`
- inject infrastructure dependencies rather than importing process globals everywhere

When adding a new feature:

1. create or extend a module under `src/modules`
2. expose a router for that feature if it needs HTTP routes
3. mount it from `src/http/router.ts`
4. keep validation in `http`
5. keep environment/database/logger setup in `infra`

## Testing Guide

The tests are integration-oriented and intentionally exercise the app through real boundaries.

### Test Commands

```sh
pnpm test
pnpm test:http
pnpm test:process
pnpm test:db
```

What each test target covers:

- `pnpm test`
  - Builds the package and runs the entire Vitest suite.
- `pnpm test:http`
  - Exercises HTTP behavior against in-memory app instances.
  - Best choice when changing routing, middleware, validation, or error handling.
- `pnpm test:process`
  - Exercises process startup, signal handling, and shutdown behavior against the compiled bootstrap entrypoint.
  - Best choice when changing bootstrapping, lifecycle, or shutdown behavior.
- `pnpm test:db`
  - Starts a PostgreSQL container and verifies readiness behavior against a real database.
  - Best choice when changing DB wiring, schema assumptions, or readiness checks.

### Test Helpers

Use existing helpers before inventing new ones:

- `tests/helpers/create-app.ts`
  - Creates a test app with configurable readiness and CORS settings.
- `tests/helpers/process.ts`
  - Starts and stops the compiled bootstrap process, captures output, and helps test signal handling.
- `tests/helpers/wait-for-http.ts`
  - Polls until an HTTP endpoint becomes reachable.
- `tests/helpers/postgres-container.ts`
  - Starts a PostgreSQL test container and returns a connection string.

Prefer extending these helpers when the new tests fit their purpose. Only add new helpers when there is a new recurring test need.

## Environment And Database Setup

### Environment File

Copy the example environment file before running the app locally:

```sh
cp .env.example .env
```

Current environment variables:

- `PORT`
- `DATABASE_URL`
- `CORS_ORIGINS`
- `NODE_ENV`
- `LOG_LEVEL`
- `SHUTDOWN_TIMEOUT_MS`

These are validated by `src/infra/env.ts`. Invalid values should fail fast before the server starts listening.

### Local Database

Use the provided Docker Compose file for local PostgreSQL:

```sh
pnpm db:up
pnpm db:down
```

The container uses PostgreSQL 17 and exposes port `5432`.

### Drizzle Commands

Use the package scripts instead of calling Drizzle tools directly:

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Rules:

- update schema definitions first
- generate or apply migrations through scripts
- keep `drizzle/` in sync with schema changes

## Package Commands

Run these from `apps/api` directly, or from the repo root with `pnpm --filter @jubilant-carnival/api <command>`.

### Development

```sh
pnpm dev
pnpm build
pnpm start
```

- `pnpm dev`
  - Runs the API with `tsx watch` against `src/bootstrap.ts`.
- `pnpm build`
  - Cleans `dist/` and compiles production output from `src/`.
- `pnpm start`
  - Runs the compiled bootstrap entrypoint from `dist/bootstrap.js`.

### Quality

```sh
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

- `pnpm typecheck`
  - Checks source, tests, and local TypeScript config files using `tsconfig.typecheck.json`.
- `pnpm lint`
  - Runs ESLint against source, tests, and key config files.
- `pnpm lint:fix`
  - Applies safe lint fixes.
- `pnpm format`
  - Formats package-owned source and config files.
- `pnpm format:check`
  - Verifies formatting without rewriting files.

### Tests

```sh
pnpm test
pnpm test:http
pnpm test:process
pnpm test:db
```

### Database

```sh
pnpm db:up
pnpm db:down
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

## Contributor Rules Of Thumb

Use these conventions as the default operating model.

- Add new HTTP middleware and router mounts in `src/http/app.ts`, not in `server.ts`.
- Add new feature route trees in `src/http/router.ts` or feature routers mounted from there, not inline in `app.ts`.
- Use `validatedRoute` for typed request parsing instead of open-coded validation in handlers.
- Throw `AppError` for expected HTTP failures; let `error-handler.ts` turn errors into responses.
- Add new environment variables in `src/infra/env.ts` and `.env.example` together.
- Construct infrastructure at the process edge, then inject it; do not create new DB pools inside feature code.
- Keep log setup in `src/infra/logger.ts`; do not create unrelated logger instances without a real need.
- Put business behavior in `src/modules/*`; keep `http` focused on transport concerns.
- Use the existing test helpers before creating new test scaffolding.
- Run checks from the repo root when validating a change, even if you worked inside the package.

## Typical Contributor Workflow

From the repo root:

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm --filter @jubilant-carnival/api db:up
pnpm --filter @jubilant-carnival/api dev
```

Before pushing:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```
