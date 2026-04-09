import { createBrowserRouter, type RouteObject } from "react-router";

import AuthErrorBoundary from "@/routes/auth/AuthErrorBoundary";
import ForgotPasswordPage from "@/routes/forgot-password/ForgotPasswordPage";
import HomePage from "@/routes/home/HomePage";
import LoginPage from "@/routes/login/LoginPage";
import NotFoundPage from "@/routes/not-found/NotFoundPage";
import ResetPasswordPage from "@/routes/reset-password/ResetPasswordPage";
import RootErrorBoundary from "@/routes/root/RootErrorBoundary";
import RootLayout from "@/routes/root/RootLayout";
import SystemPage from "@/routes/system/SystemPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/forgot-password",
    Component: ForgotPasswordPage,
    ErrorBoundary: AuthErrorBoundary,
  },
  {
    path: "/login",
    Component: LoginPage,
    ErrorBoundary: AuthErrorBoundary,
  },
  {
    path: "/reset-password",
    Component: ResetPasswordPage,
    ErrorBoundary: AuthErrorBoundary,
  },
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
