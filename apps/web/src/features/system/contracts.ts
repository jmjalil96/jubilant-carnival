import { z } from "zod";

import { ApiError } from "@/lib/api/client";

export const systemStatusSchema = z.object({
  status: z.literal("ok"),
});

export type SystemStatus = z.infer<typeof systemStatusSchema>;

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isServiceNotReadyError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 503 &&
    error.code === "service_not_ready"
  );
}
