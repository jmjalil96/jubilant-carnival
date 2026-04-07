import { z } from "zod";

import { env } from "@/lib/env";

const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorEnvelopeSchema>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor({
    status,
    code,
    message,
    details,
  }: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function normalizeApiBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function createApiUrl(path: string) {
  return `${normalizeApiBaseUrl(env.VITE_API_BASE_URL)}${normalizePath(path)}`;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");

  if (contentType === null || !contentType.includes("application/json")) {
    return undefined;
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ApiError({
      status: response.status,
      code: "invalid_api_response",
      message: "API returned malformed JSON",
    });
  }
}

function toApiError(response: Response, body: unknown) {
  const parsedEnvelope = apiErrorEnvelopeSchema.safeParse(body);

  if (parsedEnvelope.success) {
    const {
      error: { code, message, details },
    } = parsedEnvelope.data;

    return new ApiError({
      status: response.status,
      code,
      message,
      details,
    });
  }

  return new ApiError({
    status: response.status,
    code: "api_error",
    message: `API request failed with status ${response.status}`,
  });
}

export async function requestJson<T>({
  path,
  schema,
}: {
  path: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(createApiUrl(path), {
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: "network_error",
      message: "Could not reach the API",
    });
  }

  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw toApiError(response, body);
  }

  const parsedBody = schema.safeParse(body);

  if (!parsedBody.success) {
    throw new ApiError({
      status: response.status,
      code: "invalid_api_response",
      message: "API returned an unexpected response shape",
      details: parsedBody.error.flatten(),
    });
  }

  return parsedBody.data;
}
