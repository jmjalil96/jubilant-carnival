# Jubilant Carnival

This repository is a pnpm workspace monorepo. It currently contains two deployable app packages: [`@jubilant-carnival/api`](./apps/api/README.md) and [`@jubilant-carnival/web`](./apps/web/README.md). The root owns shared tooling, shared policy, CI wiring, and the standard contributor workflows.

## Monorepo Overview

- `apps/*` contains deployable applications.
- `packages/*` is reserved for shared libraries and internal packages.
- Today, the workspace contains `apps/api` and `apps/web`.
- There are no shared packages yet, so shared standards live at the repo root instead of in a package.

Use the root as the default entrypoint for checks and repo-wide workflows. Use workspace package directories for runtime code and package-specific tooling.

## Workspace Layout

```text
.
├── apps/
│   ├── api/         # Express + TypeScript API
│   └── web/         # Vite + React frontend
├── packages/        # Reserved for future shared packages
├── package.json     # Root scripts for monorepo workflows
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs
└── .github/workflows/ci.yml
```

## Shared Config

The root owns the standards that apply across the workspace.

- `package.json`
  - Defines the standard entrypoint commands for local development, typecheck, lint, format, build, test, and e2e.
  - Delegates to the app packages with `pnpm --filter`.
- `pnpm-workspace.yaml`
  - Declares `apps/*` and `packages/*` as workspace roots.
- `tsconfig.base.json`
  - Defines the strict TypeScript baseline used by workspace packages.
  - Current defaults include `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `isolatedModules`.
- `eslint.config.mjs`
  - Centralizes lint policy for both app packages, including type-aware TypeScript ESLint rules and ignored generated directories.
- `.prettierrc.json`
  - Defines shared formatting rules for the repo.
- `.github/workflows/ci.yml`
  - Runs the same core checks expected locally: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, and `pnpm test`.
  - Runs `pnpm test:e2e` as a separate Chromium smoke-test job.

If a rule is intended to apply across multiple packages, put it in root config. If it is runtime behavior for one package, keep it in that package.

## Current Packages

### `@jubilant-carnival/api`

The API package is an Express service with strict TypeScript, Zod-based validation, Drizzle ORM, PostgreSQL, and Vitest integration tests. See [`apps/api/README.md`](./apps/api/README.md) for the package architecture, `http`/`infra` usage rules, environment setup, and package-specific commands.

### `@jubilant-carnival/web`

The web package is a Vite + React frontend with React Router, TanStack Query, Tailwind v4, shadcn/ui primitives, MSW-backed integration tests, and a Playwright Chromium smoke test. See [`apps/web/README.md`](./apps/web/README.md) for package architecture, frontend usage rules, environment setup, and package-specific commands.

## Getting Started

### Prerequisites

- Node.js `24.x` as declared in [`.nvmrc`](./.nvmrc) and the root `package.json`
- `pnpm@10`
- Docker, for the local PostgreSQL container and the DB-backed test flow

### Initial Setup

From the repo root:

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @jubilant-carnival/api db:up
pnpm dev
```

Notes:

- `pnpm dev` starts the API and web apps together.
- `pnpm dev:api` starts the API only.
- `pnpm dev:web` starts the frontend only.
- Frontend dev uses `VITE_API_BASE_URL=/api/v1` and proxies `/api` traffic to the API via Vite.
- Stop the local database with `pnpm --filter @jubilant-carnival/api db:down`.

## Standard Root Commands

Run these from the repo root unless you are doing package-specific work that truly requires being inside a workspace directory.

### Quality Gates

```sh
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm build
pnpm test
pnpm test:e2e
```

### Focused Test Commands

```sh
pnpm test:http
pnpm test:process
pnpm test:db
```

What each command means today:

- `pnpm dev`
  - Starts the API and web apps together with streaming logs.
- `pnpm dev:api`
  - Starts the API package only.
- `pnpm dev:web`
  - Starts the web package only.
- `pnpm typecheck`
  - Runs typecheck for both apps, including source files, tests, and local TypeScript config files.
- `pnpm lint`
  - Runs the shared ESLint config against both apps and their relevant config files.
- `pnpm lint:fix`
  - Applies safe lint fixes in both app packages.
- `pnpm format`
  - Formats the repository with Prettier.
- `pnpm format:check`
  - Verifies the repository matches Prettier formatting without rewriting files.
- `pnpm build`
  - Builds both apps.
- `pnpm test`
  - Runs the fast/default test suites for both apps.
- `pnpm test:e2e`
  - Runs the web Playwright Chromium smoke test against a built preview and a real API process.
- `pnpm test:http`
  - Runs fast HTTP integration tests without containerized database setup.
- `pnpm test:process`
  - Verifies bootstrap, signal handling, and graceful shutdown behavior.
- `pnpm test:db`
  - Runs the database-backed readiness test using a PostgreSQL container.

## Working Conventions

Use these rules unless there is a concrete reason not to.

- Run checks from the root.
  - Root scripts are the canonical developer workflow and mirror CI.
- Keep shared policy in root config.
  - Formatting, linting, and cross-package TypeScript defaults belong at the root.
- Keep runtime logic inside the owning package.
  - Do not put app behavior in root scripts or root config files.
- Prefer package-local documentation for package internals.
  - The root README should orient contributors; detailed architectural guidance belongs with the package.
- Add future shared code under `packages/*` only when it is truly shared.
  - Do not create a shared package just to avoid a small amount of duplication.

## When Adding More Packages

If this repo grows beyond the API package:

- keep root scripts as the common contributor entrypoint
- keep root config focused on shared standards
- move reusable code into `packages/*` only when multiple apps genuinely depend on it
- add package-local READMEs for package-specific architecture and workflows

For the current application architecture, continue in [`apps/api/README.md`](./apps/api/README.md).
For frontend architecture and workflows, continue in [`apps/web/README.md`](./apps/web/README.md).
