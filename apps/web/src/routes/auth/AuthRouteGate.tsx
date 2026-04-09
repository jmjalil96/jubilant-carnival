import {
  cloneElement,
  isValidElement,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { Navigate } from "react-router";

import InlineApiErrorPanel from "@/components/feedback/InlineApiErrorPanel";
import InlineLoadingState from "@/components/feedback/InlineLoadingState";
import { useAuthSession } from "@/features/auth/queries";
import AuthLayout from "@/routes/auth/AuthLayout";

function renderCheckingState() {
  return (
    <AuthLayout
      description="We’re confirming whether you already have an active session before showing this page."
      eyebrow="Checking Session"
      title="Preparing access"
    >
      <InlineLoadingState
        description="Confirming whether you already have access."
        label="Checking session."
      />
    </AuthLayout>
  );
}

function prependAuthError(children: ReactNode, errorMessage: ReactNode) {
  if (!isValidElement<{ children?: ReactNode }>(children)) {
    return (
      <>
        {errorMessage}
        {children}
      </>
    );
  }

  return cloneElement(children, {
    children: (
      <>
        {errorMessage}
        {children.props.children}
      </>
    ),
  });
}

function AuthRouteGate({ children }: PropsWithChildren) {
  const authSession = useAuthSession();

  if (
    authSession.status === "checking" ||
    authSession.isVerifyingCachedAuthentication
  ) {
    return renderCheckingState();
  }

  if (authSession.status === "authenticated" && authSession.error === null) {
    return <Navigate replace to="/" />;
  }

  if (authSession.error !== null) {
    return prependAuthError(
      children,
      <InlineApiErrorPanel error={authSession.error} label="Auth" />,
    );
  }

  return children;
}

export default AuthRouteGate;
