import { requestJson } from "@/lib/api/client";
import {
  systemStatusSchema,
  type SystemStatus,
} from "@/features/system/contracts";

export function fetchHealth(): Promise<SystemStatus> {
  return requestJson({
    path: "/health",
    schema: systemStatusSchema,
  });
}

export function fetchReadiness(): Promise<SystemStatus> {
  return requestJson({
    path: "/ready",
    schema: systemStatusSchema,
  });
}
