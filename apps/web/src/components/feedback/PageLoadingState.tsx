import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function PageLoadingState({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Card
      aria-live="polite"
      className="border-border/70 bg-card/95 shadow-sm"
      role="status"
    >
      <CardHeader className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {eyebrow}
        </p>
        <CardTitle className="text-2xl leading-tight">{title}</CardTitle>
        <CardDescription className="max-w-2xl text-base leading-7 text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Skeleton className="size-2 rounded-full" />
          <span>Loading latest state...</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default PageLoadingState;
