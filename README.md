# Jubilant Carnival

This repository is a pnpm workspace monorepo. Right now it contains one deployable app package, [`@jubilant-carnival/api`](./apps/api/README.md), and the root is responsible for shared tooling, shared policy, and standard contributor workflows.

## Monorepo Overview

- `apps/*` contains deployable applications.
- `packages/*` is reserved for shared libraries and internal packages.
- Today, the only active workspace package is `apps/api`.
- There are no shared packages yet, so shared standards live at the repo root instead of in a package.

Use the root as the default entrypoint for checks and repo-wide workflows. Use workspace package directories for runtime code and package-specific tooling.

## Workspace Layout

```text
.
├── apps/
│   └── api/         # Express + TypeScript API
├── packages/        # Reserved for future shared packages
├── package.json     # Root scripts for checks
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs
└── .github/workflows/ci.yml
```

## Shared Config

The root owns the standards that apply across the workspace.

- `package.json`
  - Defines the standard entrypoint commands for typecheck, lint, format, build, and test.
  - Delegates today to `@jubilant-carnival/api` with `pnpm --filter`.
- `pnpm-workspace.yaml`
  - Declares `apps/*` and `packages/*` as workspace roots.
- `tsconfig.base.json`
  - Defines the strict TypeScript baseline used by workspace packages.
  - Current defaults include `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `isolatedModules`.
- `eslint.config.mjs`
  - Centralizes lint policy for the API package, including the TypeScript ESLint setup and ignored generated directories.
- `.prettierrc.json`
  - Defines shared formatting rules for the repo.
- `.github/workflows/ci.yml`
  - Runs the same core checks expected locally: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test`.

If a rule is intended to apply across multiple packages, put it in root config. If it is runtime behavior for one package, keep it in that package.

## Current Packages

### `@jubilant-carnival/api`

The API package is an Express service with strict TypeScript, Zod-based validation, Drizzle ORM, PostgreSQL, and Vitest integration tests. See [`apps/api/README.md`](./apps/api/README.md) for the package architecture, `http`/`infra` usage rules, environment setup, and package-specific commands.

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
pnpm --filter @jubilant-carnival/api db:up
pnpm --filter @jubilant-carnival/api dev
```

Notes:

- There is no root `dev` script right now.
- During development, start the API from the root with `pnpm --filter @jubilant-carnival/api dev`.
- Stop the local database with `pnpm --filter @jubilant-carnival/api db:down`.

## Standard Root Commands

Run these from the repo root unless you are doing package-specific work that truly requires being inside a workspace directory.

### Quality Gates

```sh
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm build
pnpm test
```

### Focused Test Commands

```sh
pnpm test:http
pnpm test:process
pnpm test:db
```

What each command means today:

- `pnpm typecheck`
  - Runs the API package typecheck, including source files, tests, and local TypeScript config files.
- `pnpm lint`
  - Runs the shared ESLint config against the API source, tests, and relevant package config files.
- `pnpm lint:fix`
  - Applies safe lint fixes in the API package.
- `pnpm format`
  - Formats the repository with Prettier.
- `pnpm format:check`
  - Verifies the repository matches Prettier formatting without rewriting files.
- `pnpm build`
  - Builds the API package into `apps/api/dist`.
- `pnpm test`
  - Runs the full API package test suite.
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
