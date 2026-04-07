import type { ComponentType, SVGProps } from "react";
import {
  CircleAlert,
  CircleCheckBig,
  CircleX,
  LoaderCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger";

type ToneIcon = ComponentType<SVGProps<SVGSVGElement>>;

const statusToneClasses: Record<
  StatusTone,
  {
    badge: string;
    card: string;
    description: string;
    icon: ToneIcon;
  }
> = {
  neutral: {
    badge: "border-border/70 bg-muted text-muted-foreground",
    card: "border-border/70 bg-card/95",
    description: "text-muted-foreground",
    icon: LoaderCircle,
  },
  success: {
    badge: "border-emerald-200 bg-emerald-100 text-emerald-900",
    card: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
    description: "text-emerald-900/80",
    icon: CircleCheckBig,
  },
  warning: {
    badge: "border-amber-200 bg-amber-100 text-amber-950",
    card: "border-amber-200 bg-amber-50/85 text-amber-950",
    description: "text-amber-900/80",
    icon: CircleAlert,
  },
  danger: {
    badge: "border-rose-200 bg-rose-100 text-rose-900",
    card: "border-rose-200 bg-rose-50/85 text-rose-950",
    description: "text-rose-900/80",
    icon: CircleX,
  },
};

export function StatusCard({
  label,
  status,
  title,
  description,
  tone,
}: {
  label: string;
  status: string;
  title: string;
  description: string;
  tone: StatusTone;
}) {
  const toneClasses = statusToneClasses[tone];
  const ToneIcon = toneClasses.icon;

  return (
    <Card className={cn("shadow-sm", toneClasses.card)}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {label}
          </p>
          <Badge
            className={cn("gap-1.5 rounded-full px-3 py-1", toneClasses.badge)}
            variant="outline"
          >
            <ToneIcon
              className={cn("size-3.5", tone === "neutral" && "animate-spin")}
            />
            {status}
          </Badge>
        </div>
        <CardTitle className="text-2xl leading-tight">{title}</CardTitle>
        <CardDescription
          className={cn("text-sm leading-6", toneClasses.description)}
        >
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
