import type { PropsWithChildren, ReactNode } from "react";
import { NavLink, useMatch, useResolvedPath } from "react-router";

import InlineApiErrorPanel from "@/components/feedback/InlineApiErrorPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLogoutMutation } from "@/features/auth/mutations";
import { useAuthSession } from "@/features/auth/queries";
import { cn } from "@/lib/utils";

function ShellNavLink({
  to,
  end = false,
  children,
}: {
  to: string;
  end?: boolean;
  children: string;
}) {
  const resolvedPath = useResolvedPath(to);
  const isActive = useMatch({ path: resolvedPath.pathname, end }) !== null;

  return (
    <Button
      asChild
      className={cn("rounded-full", !isActive && "bg-background/80")}
      size="sm"
      variant={isActive ? "default" : "outline"}
    >
      <NavLink discover="none" end={end} to={to}>
        {children}
      </NavLink>
    </Button>
  );
}

function AppShell({ children }: PropsWithChildren) {
  const authSession = useAuthSession();
  const logoutMutation = useLogoutMutation();
  const authError = authSession.error
    ? authSession.error
    : logoutMutation.isError
      ? logoutMutation.error
      : null;

  let authAction: ReactNode;

  if (authSession.status === "checking") {
    authAction = (
      <Button className="rounded-full" disabled size="sm" variant="outline">
        Checking session
      </Button>
    );
  } else if (authSession.status === "unauthenticated") {
    authAction = <ShellNavLink to="/login">Login</ShellNavLink>;
  } else {
    authAction = (
      <Button
        className="rounded-full"
        disabled={logoutMutation.isPending}
        onClick={() => {
          logoutMutation.mutate();
        }}
        size="sm"
        type="button"
      >
        {logoutMutation.isPending ? "Logging out..." : "Logout"}
      </Button>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="border-border/70 bg-card/95 shadow-md">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                  Jubilant Carnival
                </p>
                <p className="text-sm text-muted-foreground">
                  Infrastructure-first React starter
                </p>
              </div>
              <nav aria-label="Primary" className="flex flex-wrap gap-2">
                <ShellNavLink end to="/">
                  Home
                </ShellNavLink>
                <ShellNavLink to="/system">System</ShellNavLink>
                {authAction}
              </nav>
            </div>
            <Separator className="bg-border/70" />
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Home and system routes share the same shell, loading states, and
              route-level failure handling while the starter stays
              infrastructure-first.
            </p>
            {authError === null ? null : (
              <InlineApiErrorPanel error={authError} label="Auth" />
            )}
          </CardContent>
        </Card>
        <main className="flex-1">
          <Card className="h-full border-border/70 bg-card/95 shadow-md">
            <CardContent className="pt-6">{children}</CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
