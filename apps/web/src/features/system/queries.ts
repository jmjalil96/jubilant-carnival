import { useQuery } from "@tanstack/react-query";

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
