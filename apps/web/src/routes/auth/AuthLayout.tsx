import type { PropsWithChildren } from "react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
}>) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,244,245,0.92))]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="space-y-6">
            <Button
              asChild
              className="rounded-full bg-background/90"
              size="sm"
              variant="outline"
            >
              <Link discover="none" to="/">
                Back home
              </Link>
            </Button>
            <div className="space-y-4">
              <Badge
                className="rounded-full border-border/70 bg-background/80 px-3 py-1 tracking-[0.2em] uppercase"
                variant="outline"
              >
                Jubilant Carnival
              </Badge>
              <h1 className="max-w-xl text-4xl leading-tight font-semibold sm:text-5xl">
                Infrastructure-first access for the web client.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Sign in, recover access, and continue without leaving the
                API-backed session model behind.
              </p>
            </div>
          </section>
          <Card className="border-border/70 bg-card/95 shadow-xl backdrop-blur-sm">
            <CardHeader className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {eyebrow}
              </p>
              <h2 className="font-heading text-3xl leading-tight font-medium">
                {title}
              </h2>
              <CardDescription className="text-base leading-7 text-muted-foreground">
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
