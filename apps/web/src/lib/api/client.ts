import { apiErrorEnvelopeSchema } from "@jubilant-carnival/contracts/errors";
import type { ZodType } from "zod";

import { env } from "@/lib/env";

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

type RequestOptions = {
  path: string;
  method?: RequestInit["method"];
  body?: unknown;
  credentials?: RequestCredentials | undefined;
};

function createRequestInit({
  method,
  body,
  credentials = "include",
}: Omit<RequestOptions, "path">): RequestInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return {
    headers,
    credentials,
    ...(method === undefined ? {} : { method }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
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

async function performRequest({
  path,
  method,
  body,
  credentials,
}: RequestOptions): Promise<{
  response: Response;
  responseBody: unknown;
}> {
  let response: Response;

  try {
    response = await fetch(
      createApiUrl(path),
      createRequestInit({
        method,
        body,
        credentials,
      }),
    );
  } catch {
    throw new ApiError({
      status: 0,
      code: "network_error",
      message: "Could not reach the API",
    });
  }

  const responseBody = await parseJsonResponse(response);

  return {
    response,
    responseBody,
  };
}

export async function requestJson<T>({
  path,
  schema,
  method = "GET",
  body,
  credentials = "include",
}: {
  path: string;
  schema: ZodType<T>;
  method?: RequestInit["method"];
  body?: unknown;
  credentials?: RequestCredentials;
}): Promise<T> {
  const { response, responseBody } = await performRequest({
    path,
    method,
    body,
    credentials,
  });

  if (!response.ok) {
    throw toApiError(response, responseBody);
  }

  const parsedBody = schema.safeParse(responseBody);

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

export async function requestVoid({
  path,
  method,
  body,
  credentials = "include",
}: {
  path: string;
  method: RequestInit["method"];
  body?: unknown;
  credentials?: RequestCredentials;
}): Promise<void> {
  const { response, responseBody } = await performRequest({
    path,
    method,
    body,
    credentials,
  });

  if (!response.ok) {
    throw toApiError(response, responseBody);
  }
}
