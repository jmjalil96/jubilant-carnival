import type { ChildProcessByStdio } from "node:child_process";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createConnection, createServer, type Socket } from "node:net";
import { dirname, resolve } from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(currentDir, "../..");

export type BootstrapChildProcess = ChildProcessByStdio<
  null,
  Readable,
  Readable
>;

type StartBootstrapProcessOptions = {
  env?: NodeJS.ProcessEnv;
  port?: number;
};

type ProcessExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

export type StartedBootstrapProcess = {
  child: BootstrapChildProcess;
  port: number;
  url: string;
  getOutput: () => string;
};

export async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolvePort, rejectPort) => {
    const server = createServer();

    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (address === null || typeof address === "string") {
        server.close(() => {
          rejectPort(new Error("Failed to allocate an available port"));
        });
        return;
      }

      server.close((error) => {
        if (error) {
          rejectPort(error);
          return;
        }

        resolvePort(address.port);
      });
    });
  });
}

export async function startBootstrapProcess({
  env = {},
  port,
}: StartBootstrapProcessOptions = {}): Promise<StartedBootstrapProcess> {
  const resolvedPort = port ?? (await getAvailablePort());
  const child = spawn(process.execPath, ["dist/bootstrap.js"], {
    cwd: apiDir,
    env: {
      ...process.env,
      PORT: String(resolvedPort),
      DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:65535/jubilant_carnival_test",
      CORS_ORIGINS: "http://localhost:3000",
      NODE_ENV: "production",
      LOG_LEVEL: "info",
      SHUTDOWN_TIMEOUT_MS: "10000",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USERNAME: "smtp-user",
      SMTP_PASSWORD: "smtp-password",
      EMAIL_FROM: "no-reply@example.com",
      PASSWORD_RESET_URL_BASE: "http://localhost:3000/reset-password",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";

  child.stdout.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });

  child.stderr.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });

  return {
    child,
    port: resolvedPort,
    url: `http://127.0.0.1:${resolvedPort}`,
    getOutput: () => output,
  };
}

export async function waitForProcessExit(
  child: BootstrapChildProcess,
  timeoutMs = 5_000,
): Promise<ProcessExit> {
  const result = await Promise.race([
    once(child, "exit").then(([code, signal]) => ({
      code,
      signal,
    })),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timed out waiting for process to exit"));
      }, timeoutMs);
    }),
  ]);

  return result as ProcessExit;
}

export async function stopProcess(
  child: BootstrapChildProcess,
  signal: NodeJS.Signals,
  timeoutMs = 5_000,
): Promise<ProcessExit> {
  child.kill(signal);
  return await waitForProcessExit(child, timeoutMs);
}

export async function openIncompleteHttpConnection(
  port: number,
): Promise<Socket> {
  return await new Promise<Socket>((resolveSocket, rejectSocket) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => {
      socket.write("GET /api/v1/health HTTP/1.1\r\nHost: localhost\r\n");
      resolveSocket(socket);
    });

    socket.once("error", rejectSocket);
  });
}
