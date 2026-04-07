import { createBrowserRouter, type RouteObject } from "react-router";

import HomePage from "@/routes/home/HomePage";
import NotFoundPage from "@/routes/not-found/NotFoundPage";
import RootErrorBoundary from "@/routes/root/RootErrorBoundary";
import RootLayout from "@/routes/root/RootLayout";
import SystemPage from "@/routes/system/SystemPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "system",
        Component: SystemPage,
      },
      {
        path: "*",
        Component: NotFoundPage,
      },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
