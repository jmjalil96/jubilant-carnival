import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { FormEventHandler } from "react";
import type { Resolver, UseFormReturn } from "react-hook-form";
import type { input as ZodInput } from "zod";

import { useConfirmPasswordResetMutation } from "@/features/auth/mutations";
import {
  isApiError,
  isInvalidPasswordResetTokenError,
  passwordResetConfirmBodySchema,
} from "@/features/auth/contracts";

const resetPasswordFormSchema = passwordResetConfirmBodySchema.pick({
  password: true,
});

function toSubmitErrorMessage(error: unknown): string {
  if (isApiError(error) && error.status === 0) {
    return "The frontend could not reach the API. Make sure the backend is running and try again.";
  }

  return "Password reset failed. Please try again.";
}

export type UseResetPasswordFormResult = {
  form: UseFormReturn<
    ResetPasswordFormValues,
    undefined,
    ResetPasswordFormBody
  >;
  onSubmit: FormEventHandler<HTMLFormElement>;
  isPending: boolean;
  submitError: string | null;
};

type ResetPasswordFormValues = ZodInput<typeof resetPasswordFormSchema>;
type ResetPasswordFormBody = {
  password: string;
};

function createResetPasswordResolver(): Resolver<
  ResetPasswordFormValues,
  undefined,
  ResetPasswordFormBody
> {
  // `@hookform/resolvers` and the app's Zod import path disagree on v4 types.
  const resolverFactory = zodResolver as unknown as (
    schema: typeof resetPasswordFormSchema,
  ) => Resolver<ResetPasswordFormValues, undefined, ResetPasswordFormBody>;

  return resolverFactory(resetPasswordFormSchema);
}

export function useResetPasswordForm({
  token,
  onSuccess,
  onInvalidToken,
}: {
  token: string;
  onSuccess: () => void;
  onInvalidToken: () => void;
}): UseResetPasswordFormResult {
  const mutation = useConfirmPasswordResetMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<
    ResetPasswordFormValues,
    undefined,
    ResetPasswordFormBody
  >({
    resolver: createResetPasswordResolver(),
    defaultValues: {
      password: "",
    },
  });

  const submitHandler = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await mutation.mutateAsync({
        token,
        password: values.password,
      });
      onSuccess();
    } catch (error) {
      if (isInvalidPasswordResetTokenError(error)) {
        setSubmitError(null);
        onInvalidToken();
        return;
      }

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
