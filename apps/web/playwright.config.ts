import { createConnection, createServer } from "node:net";

import { defineConfig } from "@playwright/test";

async function resolveAvailablePort(preferredPort: number) {
  const preferredPortAvailable = await new Promise<boolean>(
    (resolve, reject) => {
      const socket = createConnection({
        host: "127.0.0.1",
        port: preferredPort,
      });

      socket.setTimeout(250);

      socket.once("connect", () => {
        socket.destroy();
        resolve(false);
      });

      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });

      socket.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ECONNREFUSED") {
          resolve(true);
          return;
        }

        reject(error);
      });
    },
  );

  if (preferredPortAvailable) {
    return preferredPort;
  }

  const fallbackServer = createServer();

  return await new Promise<number>((resolve, reject) => {
    fallbackServer.once("error", reject);
    fallbackServer.listen(0, "127.0.0.1", () => {
      const address = fallbackServer.address();

      if (address === null || typeof address === "string") {
        fallbackServer.close();
        reject(new Error("Could not resolve an available port"));
        return;
      }

      fallbackServer.close((closeError) => {
        if (closeError !== undefined) {
          reject(closeError);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

const apiPort = await resolveAvailablePort(3001);
const previewPort = await resolveAvailablePort(4173);

const apiCommand = [
  `PORT=${apiPort}`,
  "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jubilant_carnival_api",
  `CORS_ORIGINS=http://localhost:${previewPort},http://127.0.0.1:${previewPort}`,
  "NODE_ENV=development",
  "LOG_LEVEL=error",
  "SHUTDOWN_TIMEOUT_MS=10000",
  "SMTP_HOST=localhost",
  "SMTP_PORT=1025",
  "SMTP_SECURE=false",
  "SMTP_USERNAME=test",
  "SMTP_PASSWORD=test",
  "EMAIL_FROM=test@example.com",
  `PASSWORD_RESET_URL_BASE=http://localhost:${previewPort}/reset-password`,
  "pnpm --dir ../api dev",
].join(" ");

const previewCommand = [
  `VITE_API_BASE_URL=http://localhost:${apiPort}/api/v1`,
  "pnpm build",
  "&&",
  `pnpm preview -- --host localhost --port ${previewPort}`,
].join(" ");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${previewPort}`,
    browserName: "chromium",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: `sh -lc '${apiCommand}'`,
      reuseExistingServer: false,
      timeout: 120_000,
      url: `http://127.0.0.1:${apiPort}/api/v1/health`,
    },
    {
      command: `sh -lc '${previewCommand}'`,
      reuseExistingServer: false,
      timeout: 120_000,
      url: `http://localhost:${previewPort}`,
    },
  ],
});
