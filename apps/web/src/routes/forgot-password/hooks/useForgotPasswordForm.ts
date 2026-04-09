import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { FormEventHandler } from "react";
import type { Resolver, UseFormReturn } from "react-hook-form";
import type { input as ZodInput } from "zod";

import { useRequestPasswordResetMutation } from "@/features/auth/mutations";
import {
  isApiError,
  passwordResetRequestBodySchema,
  type PasswordResetRequestBody,
} from "@/features/auth/contracts";

function toSubmitErrorMessage(error: unknown): string {
  if (isApiError(error) && error.status === 0) {
    return "The frontend could not reach the API. Make sure the backend is running and try again.";
  }

  return "Password reset request failed. Please try again.";
}

export type UseForgotPasswordFormResult = {
  form: UseFormReturn<
    ForgotPasswordFormValues,
    undefined,
    PasswordResetRequestBody
  >;
  onSubmit: FormEventHandler<HTMLFormElement>;
  isPending: boolean;
  submitError: string | null;
};

type ForgotPasswordFormValues = ZodInput<typeof passwordResetRequestBodySchema>;

function createForgotPasswordResolver(): Resolver<
  ForgotPasswordFormValues,
  undefined,
  PasswordResetRequestBody
> {
  // `@hookform/resolvers` and the app's Zod import path disagree on v4 types.
  const resolverFactory = zodResolver as unknown as (
    schema: typeof passwordResetRequestBodySchema,
  ) => Resolver<ForgotPasswordFormValues, undefined, PasswordResetRequestBody>;

  return resolverFactory(passwordResetRequestBodySchema);
}

export function useForgotPasswordForm({
  onSuccess,
}: {
  onSuccess: () => void;
}): UseForgotPasswordFormResult {
  const mutation = useRequestPasswordResetMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<
    ForgotPasswordFormValues,
    undefined,
    PasswordResetRequestBody
  >({
    resolver: createForgotPasswordResolver(),
    defaultValues: {
      email: "",
    },
  });

  const submitHandler = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await mutation.mutateAsync(values);
      onSuccess();
    } catch (error) {
      setSubmitError(toSubmitErrorMessage(error));
    }
  });
  const onSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    void submitHandler(event);
  };

  return {
    form,
    onSubmit,
    isPending: mutation.isPending,
    submitError,
  };
}
