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

function booleanFromEnv(variableName: string) {
  return z.string().transform((value, ctx) => {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${variableName} must be true or false`,
    });

    return z.NEVER;
  });
}

function absoluteUrlFromEnv(variableName: string) {
  return z.string().transform((value, ctx) => {
    try {
      const parsedValue = new URL(value);

      if (
        parsedValue.protocol !== "http:" &&
        parsedValue.protocol !== "https:"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${variableName} must use the http or https protocol`,
        });

        return z.NEVER;
      }

      return parsedValue.toString();
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${variableName} must be a valid absolute URL`,
      });

      return z.NEVER;
    }
  });
}

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

const databaseUrlSchema = z.string().refine((value) => {
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
    SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
    SMTP_PORT: positiveIntegerFromEnv("SMTP_PORT"),
    SMTP_SECURE: booleanFromEnv("SMTP_SECURE"),
    SMTP_USERNAME: z.string().min(1, "SMTP_USERNAME is required"),
    SMTP_PASSWORD: z.string().min(1, "SMTP_PASSWORD is required"),
    EMAIL_FROM: z.string().min(1, "EMAIL_FROM is required"),
    EMAIL_REPLY_TO: z.string().min(1).optional(),
    PASSWORD_RESET_URL_BASE: absoluteUrlFromEnv("PASSWORD_RESET_URL_BASE"),
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

function parseAppEnv(input: unknown): AppEnv {
  return appEnvSchema.parse(input);
}

export function parseDatabaseEnv(input: unknown): DatabaseEnv {
  return databaseEnvSchema.parse(input);
}

export function loadEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return parseAppEnv(input);
}
