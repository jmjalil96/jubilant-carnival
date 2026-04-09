import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import AuthLayout from "@/routes/auth/AuthLayout";
import AuthRouteGate from "@/routes/auth/AuthRouteGate";
import ForgotPasswordForm from "@/routes/forgot-password/components/ForgotPasswordForm";
import { useForgotPasswordForm } from "@/routes/forgot-password/hooks/useForgotPasswordForm";

function ForgotPasswordPage() {
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const forgotPasswordForm = useForgotPasswordForm({
    onSuccess: () => {
      setRequestSubmitted(true);
    },
  });

  return (
    <AuthRouteGate>
      <AuthLayout
        description={
          requestSubmitted
            ? "If an account exists for the email you entered, we’ve sent a password reset link."
            : "Enter your account email and we’ll send a reset link if the account is eligible."
        }
        eyebrow="Account Recovery"
        title={requestSubmitted ? "Check your email" : "Forgot password"}
      >
        {requestSubmitted ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-full">
                <Link discover="none" to="/login">
                  Back to sign in
                </Link>
              </Button>
              <Button
                className="rounded-full"
                onClick={() => {
                  forgotPasswordForm.form.reset();
                  setRequestSubmitted(false);
                }}
                type="button"
                variant="outline"
              >
                Use a different email
              </Button>
            </div>
          </div>
        ) : (
          <ForgotPasswordForm {...forgotPasswordForm} />
        )}
      </AuthLayout>
    </AuthRouteGate>
  );
}

export default ForgotPasswordPage;
