import { HttpResponse, http } from "msw";

import { createAuthenticationRequiredErrorEnvelope } from "../helpers/api-fixtures";

function createApiPathMatcher(pathname: string) {
  const escapedPathname = pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`${escapedPathname}(?:\\?.*)?$`);
}

export const healthEndpointPattern = createApiPathMatcher("/api/v1/health");
export const readinessEndpointPattern = createApiPathMatcher("/api/v1/ready");
export const currentSessionEndpointPattern =
  createApiPathMatcher("/api/v1/auth/me");

export const defaultHandlers = [
  http.get(currentSessionEndpointPattern, () =>
    HttpResponse.json(createAuthenticationRequiredErrorEnvelope(), {
      status: 401,
    }),
  ),
  http.get(healthEndpointPattern, () => HttpResponse.json({ status: "ok" })),
  http.get(readinessEndpointPattern, () => HttpResponse.json({ status: "ok" })),
];
