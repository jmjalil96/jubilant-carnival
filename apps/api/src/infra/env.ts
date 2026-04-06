import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const logLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

const defaultLogLevelByNodeEnv = {
  development: "debug",
  production: "info",
  test: "silent",
} as const;

function positiveIntegerFromEnv(variableName: string, defaultValue?: string) {
  const schema = z.string();

  return (
    defaultValue === undefined ? schema : schema.default(defaultValue)
  ).transform((value, ctx) => {
    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${variableName} must be a positive integer`,
      });

      return z.NEVER;
    }

    return parsedValue;
  });
}

export const databaseUrlSchema = z.string().refine((value) => {
  try {
    const protocol = new URL(value).protocol;

    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}, "DATABASE_URL must use the postgres or postgresql protocol");

const appEnvSchema = z
  .object({
    PORT: positiveIntegerFromEnv("PORT", "3001"),
    DATABASE_URL: databaseUrlSchema,
    CORS_ORIGINS: z.string().transform((value, ctx) => {
      const origins = value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

      if (origins.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CORS_ORIGINS must contain at least one origin",
        });

        return z.NEVER;
      }

      return origins;
    }),
    NODE_ENV: nodeEnvSchema.default("development"),
    LOG_LEVEL: logLevelSchema.optional(),
    SHUTDOWN_TIMEOUT_MS: positiveIntegerFromEnv("SHUTDOWN_TIMEOUT_MS", "10000"),
  })
  .transform(({ LOG_LEVEL, NODE_ENV, SHUTDOWN_TIMEOUT_MS, ...rest }) => ({
    ...rest,
    NODE_ENV,
    LOG_LEVEL: LOG_LEVEL ?? defaultLogLevelByNodeEnv[NODE_ENV],
    SHUTDOWN_TIMEOUT_MS,
  }));

const databaseEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
});

export type AppEnv = z.infer<typeof appEnvSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export function parseAppEnv(input: unknown): AppEnv {
  return appEnvSchema.parse(input);
}

export function parseDatabaseEnv(input: unknown): DatabaseEnv {
  return databaseEnvSchema.parse(input);
}

export function loadEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return parseAppEnv(input);
}
