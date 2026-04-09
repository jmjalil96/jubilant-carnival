import { passwordResetTokenSchema } from "@jubilant-carnival/contracts/auth";
import { useState } from "react";
import { useSearchParams } from "react-router";

import AuthLayout from "@/routes/auth/AuthLayout";
import ResetPasswordForm from "@/routes/reset-password/components/ResetPasswordForm";
import ResetPasswordInvalidState from "@/routes/reset-password/components/ResetPasswordInvalidState";
import ResetPasswordSuccessState from "@/routes/reset-password/components/ResetPasswordSuccessState";
import { useResetPasswordForm } from "@/routes/reset-password/hooks/useResetPasswordForm";

function resolveResetToken(value: string | null): string | null {
  const parseResult = passwordResetTokenSchema.safeParse(value);

  if (!parseResult.success) {
    return null;
  }

  return parseResult.data;
}

function ResetPasswordReadyState({
  token,
  onSuccess,
  onInvalidToken,
}: {
  token: string;
  onSuccess: () => void;
  onInvalidToken: () => void;
}) {
  const resetPasswordForm = useResetPasswordForm({
    token,
    onSuccess,
    onInvalidToken,
  });

  return (
    <AuthLayout
      description="Set a new password for this account."
      eyebrow="Account Recovery"
      title="Reset password"
    >
      <ResetPasswordForm {...resetPasswordForm} />
    </AuthLayout>
  );
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [invalidToken, setInvalidToken] = useState<string | null>(null);
  const [successfulToken, setSuccessfulToken] = useState<string | null>(null);
  const token = resolveResetToken(searchParams.get("token"));

  if (token === null || invalidToken === token) {
    return (
      <AuthLayout
        description="This password reset link is invalid or has expired. Request a new link to continue."
        eyebrow="Account Recovery"
        title="Invalid reset link"
      >
        <ResetPasswordInvalidState />
      </AuthLayout>
    );
  }

  if (successfulToken === token) {
    return (
      <AuthLayout
        description="Your password has been updated. Sign in with your new password."
        eyebrow="Account Recovery"
        title="Password updated"
      >
        <ResetPasswordSuccessState />
      </AuthLayout>
    );
  }

  return (
    <ResetPasswordReadyState
      onInvalidToken={() => {
        setSuccessfulToken(null);
        setInvalidToken(token);
      }}
      onSuccess={() => {
        setInvalidToken(null);
        setSuccessfulToken(token);
      }}
      token={token}
    />
  );
}

export default ResetPasswordPage;
