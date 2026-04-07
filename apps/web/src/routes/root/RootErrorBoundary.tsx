import { useEffect } from "react";
import { useRouteError } from "react-router";

import {
  StatePrimaryLink,
  StateSecondaryButton,
} from "@/components/feedback/RouteStateMessage";
import RouteStateMessage from "@/components/feedback/RouteStateMessage";
import { isDevelopment } from "@/lib/env";
import AppShell from "@/routes/root/AppShell";
import { normalizeRouteError } from "@/routes/root/route-error";

function RootErrorBoundary() {
  const error = useRouteError();
  const normalizedError = normalizeRouteError(error);

  useEffect(() => {
    if (isDevelopment) {
      console.error("Route error boundary caught an error", error);
    }
  }, [error]);

  return (
    <AppShell>
      <RouteStateMessage
        eyebrow={normalizedError.eyebrow}
        title={normalizedError.title}
        description={normalizedError.description}
      >
        <StatePrimaryLink to="/">Return home</StatePrimaryLink>
        <StateSecondaryButton
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload page
        </StateSecondaryButton>
      </RouteStateMessage>
    </AppShell>
  );
}

export default RootErrorBoundary;
