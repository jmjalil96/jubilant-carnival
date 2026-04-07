import { http, HttpResponse } from "msw";

function createApiPathMatcher(pathname: string) {
  const escapedPathname = pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`${escapedPathname}(?:\\?.*)?$`);
}

export const healthEndpointPattern = createApiPathMatcher("/api/v1/health");
export const readinessEndpointPattern = createApiPathMatcher("/api/v1/ready");

export const defaultHandlers = [
  http.get(healthEndpointPattern, () => HttpResponse.json({ status: "ok" })),
  http.get(readinessEndpointPattern, () => HttpResponse.json({ status: "ok" })),
];
