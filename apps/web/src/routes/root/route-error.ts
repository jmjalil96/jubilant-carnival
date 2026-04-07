import { isRouteErrorResponse } from "react-router";

export function normalizeRouteError(error: unknown) {
  if (isRouteErrorResponse(error)) {
    const fallbackMessage =
      error.status === 404
        ? "The requested page could not be found."
        : "The route failed before it could finish rendering.";

    return {
      eyebrow: "Route Error",
      title: `${error.status} ${error.statusText}`,
      description:
        typeof error.data === "string" && error.data.length > 0
          ? error.data
          : fallbackMessage,
    };
  }

  if (error instanceof Error) {
    return {
      eyebrow: "Application Error",
      title: "Something went wrong.",
      description:
        error.message.length > 0
          ? error.message
          : "The route crashed before it could finish rendering.",
    };
  }

  return {
    eyebrow: "Application Error",
    title: "Something went wrong.",
    description: "The route crashed before it could finish rendering.",
  };
}
