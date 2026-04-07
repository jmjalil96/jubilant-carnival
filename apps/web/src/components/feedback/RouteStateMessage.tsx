import { Link } from "react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function RouteStateMessage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {eyebrow}
        </p>
        <CardTitle className="max-w-3xl text-3xl leading-tight sm:text-4xl">
          {title}
        </CardTitle>
        <CardDescription className="max-w-2xl text-base leading-7 text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      {children === undefined ? null : (
        <CardContent>
          <div className="flex flex-wrap gap-3">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}

export function StatePrimaryLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Button asChild className="rounded-full">
      <Link to={to}>{children}</Link>
    </Button>
  );
}

export function StateSecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      className="rounded-full"
      onClick={onClick}
      type="button"
      variant="outline"
    >
      {children}
    </Button>
  );
}

export default RouteStateMessage;
