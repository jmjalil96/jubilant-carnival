import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderAppRoute } from "../helpers/render-router";

describe("app routing integration", () => {
  it("renders the home route inside the shared shell", () => {
    renderAppRoute("/");

    expect(screen.getByText("Jubilant Carnival")).toBeInTheDocument();
    expect(screen.getByText("`apps/web` is live.")).toBeInTheDocument();
  });

  it("renders the not found state inside the shared shell", () => {
    renderAppRoute("/missing");

    expect(screen.getByText("Jubilant Carnival")).toBeInTheDocument();
    expect(screen.getByText("That page does not exist.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return home" }),
    ).toBeInTheDocument();
  });

  it("renders the shell navigation links and marks the active route", () => {
    renderAppRoute("/system");

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "System" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("heading", { name: "System checks are live." }),
    ).toBeInTheDocument();
  });
});
