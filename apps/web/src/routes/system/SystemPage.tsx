import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import InlineApiErrorPanel from "@/components/feedback/InlineApiErrorPanel";
import InlineLoadingState from "@/components/feedback/InlineLoadingState";
import PageLoadingState from "@/components/feedback/PageLoadingState";
import {
  isApiError,
  isServiceNotReadyError,
} from "@/features/system/contracts";
import { StatusCard } from "@/features/system/StatusCard";
import { useHealthQuery, useReadinessQuery } from "@/features/system/queries";

function SystemPage() {
  const healthQuery = useHealthQuery();
  const readinessQuery = useReadinessQuery();
  const isRefreshing = healthQuery.isFetching || readinessQuery.isFetching;
  const hasSettledResult =
    healthQuery.data !== undefined ||
    readinessQuery.data !== undefined ||
    healthQuery.isError ||
    readinessQuery.isError;

  function handleRefresh() {
    void Promise.all([healthQuery.refetch(), readinessQuery.refetch()]);
  }

  if (!hasSettledResult) {
    return (
      <section className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            System Page
          </p>
          <h1 className="max-w-3xl text-4xl leading-tight font-semibold sm:text-5xl">
            System checks are live.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            This page calls the API health and readiness endpoints on load and
            lets you refresh them manually while the starter stays
            infrastructure-first.
          </p>
        </div>
        <PageLoadingState
          eyebrow="Initial Load"
          title="Loading system status."
          description="The frontend is waiting for the first health and readiness results before showing the route state."
        />
      </section>
    );
  }

  let healthCard: ReactNode;

  if (healthQuery.isPending) {
    healthCard = (
      <StatusCard
        description="The frontend is waiting for the health endpoint to respond."
        label="Health"
        status="Checking"
        title="Checking"
        tone="neutral"
      />
    );
  } else if (healthQuery.isError) {
    healthCard = isApiError(healthQuery.error) ? (
      <InlineApiErrorPanel error={healthQuery.error} label="Health" />
    ) : (
      <StatusCard
        description="Unexpected error"
        label="Health"
        status="Unavailable"
        title="Unavailable"
        tone="danger"
      />
    );
  } else {
    healthCard = (
      <StatusCard
        description="The API process is responding successfully."
        label="Health"
        status="Healthy"
        title="Healthy"
        tone="success"
      />
    );
  }

  let readinessCard: ReactNode;

  if (readinessQuery.isPending) {
    readinessCard = (
      <StatusCard
        description="The frontend is waiting for the readiness endpoint to respond."
        label="Readiness"
        status="Checking"
        title="Checking"
        tone="neutral"
      />
    );
  } else if (
    readinessQuery.isError &&
    isServiceNotReadyError(readinessQuery.error)
  ) {
    readinessCard = (
      <StatusCard
        description={`${readinessQuery.error.code}: ${readinessQuery.error.message}`}
        label="Readiness"
        status="Not Ready"
        title="Not Ready"
        tone="warning"
      />
    );
  } else if (readinessQuery.isError) {
    readinessCard = isApiError(readinessQuery.error) ? (
      <InlineApiErrorPanel error={readinessQuery.error} label="Readiness" />
    ) : (
      <StatusCard
        description="Unexpected error"
        label="Readiness"
        status="Unavailable"
        title="Unavailable"
        tone="danger"
      />
    );
  } else {
    readinessCard = (
      <StatusCard
        description="The API dependencies are available and the service is ready."
        label="Readiness"
        status="Ready"
        title="Ready"
        tone="success"
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          System Page
        </p>
        <h1 className="max-w-3xl text-4xl leading-tight font-semibold sm:text-5xl">
          System checks are live.
        </h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          This page calls the API health and readiness endpoints on load and
          lets you refresh them manually while the starter stays
          infrastructure-first.
        </p>
      </div>
      <div className="flex flex-col gap-4 rounded-4xl border border-border/70 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="rounded-full"
            disabled={isRefreshing}
            onClick={handleRefresh}
            type="button"
          >
            <RefreshCw
              className={cn("size-4", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
          {isRefreshing ? (
            <InlineLoadingState
              description="The latest health and readiness checks are in flight."
              label="Refreshing."
            />
          ) : null}
        </div>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Health and readiness refetch together. There is no polling or
          background window-focus refetch.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {healthCard}
        {readinessCard}
      </div>
    </section>
  );
}

export default SystemPage;
