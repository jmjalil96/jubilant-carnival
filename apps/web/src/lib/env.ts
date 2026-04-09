import { z } from "zod";

const apiBaseUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value.startsWith("/")) {
        return true;
      }

      try {
        const parsedUrl = new URL(value);

        return (
          parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
        );
      } catch {
        return false;
      }
    },
    {
      message:
        "VITE_API_BASE_URL must be root-relative like '/api/v1' or an absolute http(s) URL",
    },
  );

const browserEnvSchema = z.object({
  VITE_API_BASE_URL: apiBaseUrlSchema.default("/api/v1"),
});

export function parseBrowserEnv(input: Record<string, unknown>) {
  return browserEnvSchema.parse(input);
}

export const env = parseBrowserEnv(import.meta.env);
export const isDevelopment = import.meta.env.DEV;
