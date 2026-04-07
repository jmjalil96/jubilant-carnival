import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(currentDir, "../..");

export async function runDatabaseMigrations(
  connectionString: string,
): Promise<{ code: number | null; output: string }> {
  const child = spawn("pnpm", ["db:migrate"], {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
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

  const code = await new Promise<number | null>((resolveCode) => {
    child.once("exit", (exitCode) => {
      resolveCode(exitCode);
    });
  });

  return { code, output };
}
