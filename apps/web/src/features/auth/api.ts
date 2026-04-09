import {
  currentSessionSchema,
  type CurrentSession,
  type LoginBody,
  type PasswordResetConfirmBody,
  type PasswordResetRequestBody,
} from "@jubilant-carnival/contracts/auth";
import { requestJson, requestVoid } from "@/lib/api/client";

export function login(input: LoginBody): Promise<CurrentSession> {
  return requestJson({
    path: "/auth/session",
    schema: currentSessionSchema,
    method: "POST",
    body: input,
  });
}

export function fetchCurrentSession(): Promise<CurrentSession> {
  return requestJson({
    path: "/auth/me",
    schema: currentSessionSchema,
  });
}

export function logout(): Promise<void> {
  return requestVoid({
    path: "/auth/session",
    method: "DELETE",
  });
}

export function requestPasswordReset(
  input: PasswordResetRequestBody,
): Promise<void> {
  return requestVoid({
    path: "/auth/password-reset",
    method: "POST",
    body: input,
  });
}

export function confirmPasswordReset(
  input: PasswordResetConfirmBody,
): Promise<void> {
  return requestVoid({
    path: "/auth/password-reset/confirm",
    method: "POST",
    body: input,
  });
}
