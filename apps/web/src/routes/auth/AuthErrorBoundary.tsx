import { useEffect } from "react";
import { Link, useRouteError } from "react-router";

import { Button } from "@/components/ui/button";
import { isDevelopment } from "@/lib/env";
import AuthLayout from "@/routes/auth/AuthLayout";
import { normalizeRouteError } from "@/routes/root/route-error";

function AuthErrorBoundary() {
  const error = useRouteError();
  const normalizedError = normalizeRouteError(error);

  useEffect(() => {
    if (isDevelopment) {
      console.error("Auth route error boundary caught an error", error);
    }
  }, [error]);

  return (
    <AuthLayout
      description={normalizedError.description}
      eyebrow={normalizedError.eyebrow}
      title={normalizedError.title}
    >
      <div className="flex flex-wrap gap-3">
        <Button asChild className="rounded-full">
          <Link discover="none" to="/">
            Return home
          </Link>
        </Button>
        <Button
          className="rounded-full"
          onClick={() => {
            window.location.reload();
          }}
          type="button"
          variant="outline"
        >
          Reload page
        </Button>
      </div>
    </AuthLayout>
  );
}

export default AuthErrorBoundary;
