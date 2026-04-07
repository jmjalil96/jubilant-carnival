import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  healthEndpointPattern,
  readinessEndpointPattern,
} from "../setup/handlers";
import { server } from "../setup/server";
import { renderAppRoute } from "../helpers/render-router";

async function findStatusCardTitle(name: string) {
  return screen.findByText(name, {
    selector: '[data-slot="card-title"]',
  });
}

describe("/system route integration", () => {
  it("shows the page-level loading state before the first results arrive", async () => {
    server.use(
      http.get(healthEndpointPattern, async () => {
        await delay(150);
        return HttpResponse.json({ status: "ok" });
      }),
      http.get(readinessEndpointPattern, async () => {
        await delay(150);
        return HttpResponse.json({ status: "ok" });
      }),
    );

    renderAppRoute("/system");

    expect(screen.getByText("Loading system status.")).toBeInTheDocument();
    expect(screen.getByText("Loading latest state...")).toBeInTheDocument();

    expect(await findStatusCardTitle("Healthy")).toBeInTheDocument();
    expect(await findStatusCardTitle("Ready")).toBeInTheDocument();
  });

  it("renders healthy and ready states when both checks succeed", async () => {
    renderAppRoute("/system");

    expect(await findStatusCardTitle("Healthy")).toBeInTheDocument();
    expect(await findStatusCardTitle("Ready")).toBeInTheDocument();
    expect(
      screen.getByText("The API process is responding successfully."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The API dependencies are available and the service is ready.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the degraded readiness state for service_not_ready", async () => {
    server.use(
      http.get(readinessEndpointPattern, () =>
        HttpResponse.json(
          {
            error: {
              code: "service_not_ready",
              message: "Service is not ready",
            },
          },
          { status: 503 },
        ),
      ),
    );

    renderAppRoute("/system");

    expect(await findStatusCardTitle("Healthy")).toBeInTheDocument();
    expect(await findStatusCardTitle("Not Ready")).toBeInTheDocument();
    expect(
      screen.getByText("service_not_ready: Service is not ready"),
    ).toBeInTheDocument();
  });

  it("renders the inline API error panel for generic API failures", async () => {
    server.use(
      http.get(readinessEndpointPattern, () =>
        HttpResponse.json(
          {
            error: {
              code: "database_unavailable",
              message: "Database is unavailable",
            },
          },
          { status: 500 },
        ),
      ),
    );

    renderAppRoute("/system");

    expect(await findStatusCardTitle("Healthy")).toBeInTheDocument();
    expect(await screen.findByText("Request failed")).toBeInTheDocument();
    expect(
      screen.getByText("database_unavailable: Database is unavailable"),
    ).toBeInTheDocument();
  });

  it("refetches both checks on refresh while keeping the current content visible", async () => {
    let healthCalls = 0;
    let readinessCalls = 0;

    server.use(
      http.get(healthEndpointPattern, async () => {
        healthCalls += 1;

        if (healthCalls > 1) {
          await delay(150);
        }

        return HttpResponse.json({ status: "ok" });
      }),
      http.get(readinessEndpointPattern, async () => {
        readinessCalls += 1;

        if (readinessCalls > 1) {
          await delay(150);
        }

        return HttpResponse.json({ status: "ok" });
      }),
    );

    const { user } = renderAppRoute("/system");

    expect(await findStatusCardTitle("Healthy")).toBeInTheDocument();
    expect(await findStatusCardTitle("Ready")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(screen.getByText(/Refreshing\./)).toBeInTheDocument();
    expect(
      screen.getByText("Healthy", { selector: '[data-slot="card-title"]' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ready", { selector: '[data-slot="card-title"]' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(healthCalls).toBe(2);
      expect(readinessCalls).toBe(2);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Refreshing\./)).not.toBeInTheDocument();
    });
  });
});
