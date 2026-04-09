import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  type LoginBody,
} from "@jubilant-carnival/contracts/auth";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { FormEventHandler } from "react";
import type { Resolver, UseFormReturn } from "react-hook-form";
import { z, type input as ZodInput } from "zod";

import { useLoginMutation } from "@/features/auth/mutations";
import {
  isApiError,
  isEmailNotVerifiedError,
  isInvalidCredentialsError,
  isPasswordResetRequiredError,
} from "@/features/auth/errors";

const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(
      EMAIL_MAX_LENGTH,
      `Email must be ${EMAIL_MAX_LENGTH} characters or fewer`,
    ),
  password: z
    .string()
    .min(1, "Password is required")
    .max(
      PASSWORD_MAX_LENGTH,
      `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`,
    ),
});

function toSubmitErrorMessage(error: unknown): string {
  if (isInvalidCredentialsError(error)) {
    return "Invalid email or password";
  }

  if (isEmailNotVerifiedError(error)) {
    return "Email address is not verified";
  }

  if (isPasswordResetRequiredError(error)) {
    return "Password reset is required";
  }

  if (isApiError(error) && error.status === 0) {
    return "The frontend could not reach the API. Make sure the backend is running and try again.";
  }

  return "Sign in failed. Please try again.";
}

export type UseLoginFormResult = {
  form: UseFormReturn<LoginFormValues, undefined, LoginBody>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  isPending: boolean;
  submitError: string | null;
};

type LoginFormValues = ZodInput<typeof loginFormSchema>;

function createLoginResolver(): Resolver<
  LoginFormValues,
  undefined,
  LoginBody
> {
  // `@hookform/resolvers` and the app's Zod import path disagree on v4 types.
  const resolverFactory = zodResolver as unknown as (
    schema: typeof loginFormSchema,
  ) => Resolver<LoginFormValues, undefined, LoginBody>;

  return resolverFactory(loginFormSchema);
}

export function useLoginForm({
  onSuccess,
}: {
  onSuccess: () => void;
}): UseLoginFormResult {
  const mutation = useLoginMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<LoginFormValues, undefined, LoginBody>({
    resolver: createLoginResolver(),
    defaultValues: {
      email: "",
      password: "",
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
