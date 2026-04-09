# `@jubilant-carnival/web`

This package is the frontend application in the monorepo. It is a Vite + React SPA with React Router for navigation, TanStack Query for server state, Tailwind v4 and shadcn/ui for UI structure, and package-local integration tests with Vitest, React Testing Library, MSW, and Playwright.

Use the [root README](../../README.md) for monorepo-wide workflows and shared config. Use this document for package architecture, contributor rules, and package-specific commands.

## Purpose And Entrypoints

The package has three top-level app layers:

- `src/main.tsx`
  - Imports the global stylesheet.
  - Finds the browser root element.
  - Mounts the app in `React.StrictMode`.
  - Exists to keep browser bootstrap concerns out of app composition.
- `src/app/App.tsx`
  - Mounts the app providers and the router.
  - Should stay thin.
- `src/app/AppProviders.tsx`
  - Owns `QueryClientProvider`.
  - Mounts React Query Devtools in development only.

The frontend currently exposes:

- `/`
  - Home route.
- `/system`
  - Health and readiness status page backed by the API.
- wildcard not-found handling inside the shared shell.

## Directory Map

```text
apps/web
├── src/
│   ├── app/                 # Router and app-wide providers
│   ├── components/
│   │   ├── feedback/        # Shared route, loading, and API error states
│   │   └── ui/              # shadcn/ui primitives
│   ├── features/
│   │   └── system/          # First real API-backed feature slice
│   ├── lib/                 # Env parsing, API client, UI helpers
│   ├── routes/              # Route components, root shell, route errors
│   ├── styles/              # Global Tailwind entrypoint
│   └── main.tsx
├── tests/
│   ├── e2e/                 # Playwright smoke coverage
│   ├── helpers/             # Test render and router helpers
│   ├── integration/         # Route and adapter integration tests
│   └── setup/               # MSW handlers, server, Vitest setup
├── components.json          # shadcn/ui package config
├── playwright.config.ts
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.app.json
├── tsconfig.node.json
└── package.json
```

How to read the structure:

- `src/app` owns application composition.
- `src/routes` owns navigation structure, the shared shell, and route-level fallbacks.
- `src/features` owns feature-local contracts, query hooks, and API calls.
- `src/lib` owns infrastructure adapters and helpers.
- `src/components/ui` is for reusable visual primitives.
- `tests` exercises the app through route, API, and browser boundaries.

## How To Use `src/app`

### `App.tsx`

Keep `App.tsx` focused on application composition. Its job is to mount providers and the router, not to own page markup or data fetching.

### `AppProviders.tsx`

Use this file for app-wide providers that should wrap the whole React tree. Today that means TanStack Query. Add future providers here only when they apply app-wide.

Do not scatter provider setup through route components.

### `router.tsx`

`router.tsx` is the single source of truth for route structure.

Use it to:

- declare the route tree
- mount the shared root layout
- attach the root route error boundary
- keep route composition easy to scan

Do not put feature logic in `router.tsx`. Route components and feature modules should own behavior.

### `query-client.ts`

This file owns the shared TanStack Query defaults and the production query client.

Current defaults intentionally keep the starter explicit:

- `retry: false`
- `refetchOnWindowFocus: false`

Keep that behavior unless a concrete product need justifies changing it.

## How To Use `src/routes`

The `routes` folder is the route boundary, not the feature layer.

### `routes/root/*`

`routes/root` owns the shared shell and route failure behavior:

- `AppShell.tsx`
  - shared chrome for normal routes and route-crash fallbacks
- `RootLayout.tsx`
  - wraps route content in the shell and renders the `Outlet`
- `RootErrorBoundary.tsx`
  - keeps the shell visible during route/render failures
- `route-error.ts`
  - normalizes thrown route errors into the fallback UI contract

Keep shell and route-error logic here. Do not duplicate it per route.

### Route Components

Current route components are:

- `routes/login/LoginPage.tsx`
- `routes/forgot-password/ForgotPasswordPage.tsx`
- `routes/reset-password/ResetPasswordPage.tsx`
- `routes/home/HomePage.tsx`
- `routes/system/SystemPage.tsx`
- `routes/not-found/NotFoundPage.tsx`

Use route components to:

- assemble route-local UI
- call feature hooks
- decide how to render loading, success, and failure states

Do not put API client code directly in routes when a feature module can own it.

The current web app assumes the API auth routes are mounted. The shared shell and auth route gate call `/api/v1/auth/me`, so running the backend without auth routes is only appropriate for tests or API-only compositions.

## How To Use `src/features`

Feature folders are the frontend equivalent of backend modules.

Current example:

- `features/system/contracts.ts`
  - Zod schemas for the system endpoints
- `features/system/api.ts`
  - typed API fetchers for `/health` and `/ready`
- `features/system/queries.ts`
  - query keys and TanStack Query hooks

Follow this pattern when adding new API-backed features:

1. define the contract with Zod
2. add feature-local fetchers
3. expose query hooks
4. keep route components thin

Do not put all fetchers in one global file and do not move route-specific server state into a global store by default.

## How To Use `src/lib`

### `env.ts`

`env.ts` is the only browser-side source of truth for frontend environment values.

Use it to:

- parse `import.meta.env`
- provide defaults
- export typed env data inward

If you add a new client-visible env var:

1. add it to `env.ts`
2. add it to `.env.example`
3. keep the rest of the app from reading `import.meta.env` directly

### `api/client.ts`

This file owns the frontend API boundary.

Responsibilities:

- building URLs from `VITE_API_BASE_URL`
- sending JSON requests
- validating response shapes
- normalizing failures into `ApiError`

Use this layer for generic request behavior. Feature modules should call into it; route components should not hand-roll `fetch` calls.

### `utils.ts`

`utils.ts` currently exports the shared `cn()` helper used by shadcn/ui components. Keep it focused on small, reusable frontend utilities.

## UI And Styling Conventions

The current UI stack is:

- Tailwind v4 via `@tailwindcss/vite`
- `src/styles/globals.css` as the Tailwind entrypoint
- shadcn/ui primitives under `src/components/ui`
- shared app-state components under `src/components/feedback`

Current reusable state components include:

- `RouteStateMessage`
- `InlineApiErrorPanel`
- `PageLoadingState`
- `InlineLoadingState`

Use these before inventing new loading or error treatments. Keep the shell mounted at all times and keep generic API failures inline within the route instead of escalating them to the route boundary.

The app currently behaves as light-only. Do not add dark-mode behavior or a theme toggle unless that becomes a deliberate product requirement.

## Environment And Local Development

Copy the web example environment file before local development:

```sh
cp .env.example .env
```

Current env contract:

- `VITE_API_BASE_URL`
  - browser-visible API base path
  - default local value: `/api/v1`
- `API_PROXY_TARGET`
  - Vite dev-server proxy target
  - default local value: `http://127.0.0.1:3001`

Local development flow from the repo root:

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @jubilant-carnival/api db:up
pnpm dev
```

Notes:

- `pnpm dev` starts both the API and frontend.
- `pnpm dev:web` starts only the frontend.
- `pnpm dev:api` starts only the API.
- Frontend dev uses the Vite proxy for `/api` calls.

## Testing Guide

The frontend tests are integration-first.

### Test Commands

```sh
pnpm test
pnpm test:e2e
```

What each command covers:

- `pnpm test`
  - Runs the Vitest suite with RTL and MSW.
  - Exercises the real route tree, shared shell, query behavior, `/system` page states, and adapter contracts.
- `pnpm test:e2e`
  - Runs the Chromium Playwright smoke test.
  - Starts the real API process and a built frontend preview.
  - Verifies app boot, basic navigation, and live `/system` API reachability.

### Test Harness

Use the existing test helpers before creating new ones:

- `tests/helpers/render-router.tsx`
  - mounts the real route tree with a fresh Query client
- `tests/setup/handlers.ts`
  - MSW handlers for `/health` and `/ready`
- `tests/setup/server.ts`
  - shared MSW server lifecycle
- `tests/setup/vitest.setup.ts`
  - Vitest global test setup

Current direct adapter tests focus only on stable contracts:

- `src/lib/api/client.ts`
- `src/routes/root/route-error.ts`

That is intentional. Prefer route-level integration tests over implementation-coupled component tests.

## Package Commands

Run these from `apps/web` only when you specifically need the package-local workflow. Otherwise prefer the root monorepo scripts.

```sh
pnpm dev
pnpm build
pnpm preview
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm test
pnpm test:e2e
```

## Contributor Rules Of Thumb

Use these defaults unless there is a concrete reason not to:

- Keep `main.tsx` browser-only.
- Keep `App.tsx` composition-only.
- Keep route structure in `src/app/router.tsx`.
- Keep API calls in `src/lib/api` and feature folders, not directly in route components.
- Keep server state in TanStack Query hooks, not a global store.
- Keep generic API failures inline within the page.
- Keep route crashes inside the shared shell via the root error boundary.
- Keep shared presentation in shadcn/ui primitives and shared feedback components.
- Keep `react-hook-form + zod` deferred until a real form feature exists.

For monorepo-wide workflows and shared config, return to the [root README](../../README.md).
