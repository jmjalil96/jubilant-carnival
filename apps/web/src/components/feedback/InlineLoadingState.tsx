import { LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

function InlineLoadingState({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div aria-live="polite" role="status">
      <Badge
        className="h-auto gap-2 rounded-full px-3 py-1 text-sm leading-6"
        variant="outline"
      >
        <LoaderCircle className="size-3.5 animate-spin" />
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{label}</span>{" "}
          {description}
        </span>
      </Badge>
    </div>
  );
}

export default InlineLoadingState;
