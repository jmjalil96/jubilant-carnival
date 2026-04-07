import { useQuery } from "@tanstack/react-query";

import type { ApiError } from "@/lib/api/client";
import { fetchHealth, fetchReadiness } from "@/features/system/api";

export const systemQueryKeys = {
  all: ["system"] as const,
  health: () => [...systemQueryKeys.all, "health"] as const,
  readiness: () => [...systemQueryKeys.all, "readiness"] as const,
};

export function useHealthQuery() {
  return useQuery({
    queryKey: systemQueryKeys.health(),
    queryFn: fetchHealth,
  });
}

export function useReadinessQuery() {
  return useQuery({
    queryKey: systemQueryKeys.readiness(),
    queryFn: fetchReadiness,
  });
}

export type SystemQueryError = ApiError;
