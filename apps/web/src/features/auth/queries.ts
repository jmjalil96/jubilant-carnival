import { useEffect, useRef } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { fetchCurrentSession } from "@/features/auth/api";
import {
  isAuthenticationRequiredError,
  type CurrentSession,
} from "@/features/auth/contracts";
import type { ApiError } from "@/lib/api/client";

export const authQueryKeys = {
  all: ["auth"] as const,
  currentSession: () => [...authQueryKeys.all, "current-session"] as const,
};
const MAX_TIMEOUT_MS = 2_147_483_647;

export type AuthSessionStatus =
  | "checking"
  | "authenticated"
  | "unauthenticated";

async function resolveCurrentSession(): Promise<CurrentSession | null> {
  try {
    return await fetchCurrentSession();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return null;
    }

    throw error;
  }
}

function useCurrentSessionQuery(): UseQueryResult<
  CurrentSession | null,
  ApiError
> {
  return useQuery({
    queryKey: authQueryKeys.currentSession(),
    queryFn: resolveCurrentSession,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useAuthSession(): {
  status: AuthSessionStatus;
  session: CurrentSession | null;
  error: ApiError | null;
  isRefreshing: boolean;
  isVerifyingCachedAuthentication: boolean;
} {
  const queryClient = useQueryClient();
  const currentSessionQuery = useCurrentSessionQuery();
  const invalidatedExpiredSessionRef = useRef<string | null>(null);
  const session =
    currentSessionQuery.data === undefined || currentSessionQuery.data === null
      ? null
      : currentSessionQuery.data;
  const error = currentSessionQuery.isError ? currentSessionQuery.error : null;
  const isVerifyingCachedAuthentication =
    session !== null &&
    currentSessionQuery.isFetching &&
    !currentSessionQuery.isFetchedAfterMount;

  let status: AuthSessionStatus;

  if (session !== null) {
    status = "authenticated";
  } else if (currentSessionQuery.data === null || error !== null) {
    status = "unauthenticated";
  } else {
    status = "checking";
  }

  useEffect(() => {
    if (session === null) {
      invalidatedExpiredSessionRef.current = null;
      return;
    }

    const invalidateCurrentSession = () => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.currentSession(),
      });
    };
    const expiresAt = session.session.expiresAt;
    const expiresAtMs = new Date(expiresAt).getTime();
    let timer: number | undefined;

    if (Number.isNaN(expiresAtMs)) {
      invalidatedExpiredSessionRef.current = null;
      return;
    }

    const scheduleInvalidation = () => {
      const delayMs = expiresAtMs - Date.now();

      if (delayMs <= 0) {
        if (invalidatedExpiredSessionRef.current === expiresAt) {
          return;
        }

        invalidatedExpiredSessionRef.current = expiresAt;
        invalidateCurrentSession();
        return;
      }

      invalidatedExpiredSessionRef.current = null;

      timer = window.setTimeout(
        scheduleInvalidation,
        Math.min(delayMs, MAX_TIMEOUT_MS),
      );
    };

    scheduleInvalidation();

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [queryClient, session?.session.expiresAt]);

  return {
    status,
    session,
    error,
    isRefreshing: currentSessionQuery.isFetching,
    isVerifyingCachedAuthentication,
  };
}
