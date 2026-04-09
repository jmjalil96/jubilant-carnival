import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  confirmPasswordReset,
  login,
  logout,
  requestPasswordReset,
} from "@/features/auth/api";
import { authQueryKeys } from "@/features/auth/queries";
import type {
  CurrentSession,
  LoginBody,
  PasswordResetConfirmBody,
  PasswordResetRequestBody,
} from "@/features/auth/contracts";
import type { ApiError } from "@/lib/api/client";

export function useLoginMutation(): UseMutationResult<
  CurrentSession,
  ApiError,
  LoginBody
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    async onSuccess(result) {
      await queryClient.cancelQueries({
        queryKey: authQueryKeys.currentSession(),
      });
      queryClient.setQueryData(authQueryKeys.currentSession(), result);
    },
  });
}

export function useRequestPasswordResetMutation(): UseMutationResult<
  void,
  ApiError,
  PasswordResetRequestBody
> {
  return useMutation({
    mutationFn: requestPasswordReset,
  });
}

export function useConfirmPasswordResetMutation(): UseMutationResult<
  void,
  ApiError,
  PasswordResetConfirmBody
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: confirmPasswordReset,
    async onSuccess() {
      await queryClient.cancelQueries({
        queryKey: authQueryKeys.currentSession(),
      });
      queryClient.setQueryData(authQueryKeys.currentSession(), null);
    },
  });
}

export function useLogoutMutation(): UseMutationResult<void, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    async onSuccess() {
      await queryClient.cancelQueries({
        queryKey: authQueryKeys.currentSession(),
      });
      queryClient.setQueryData(authQueryKeys.currentSession(), null);
    },
  });
}
