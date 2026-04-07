import { z } from "zod";

const viteRuntimeEnvSchema = z.object({
  API_PROXY_TARGET: z
    .url("API_PROXY_TARGET must be a valid URL")
    .default("http://127.0.0.1:3001"),
});

export type ViteRuntimeEnv = z.infer<typeof viteRuntimeEnvSchema>;

export function parseViteRuntimeEnv(
  input: Record<string, string>,
): ViteRuntimeEnv {
  return viteRuntimeEnvSchema.parse(input);
}
