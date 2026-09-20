import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "muted" | "success" | "warning" | "danger" | "primary";

const VARIANTS: Record<Variant, string> = {
  default: "bg-foreground text-background",
  primary: "bg-primary-soft text-primary ring-1 ring-primary/20",
  outline: "border border-border text-foreground",
  muted: "bg-muted text-muted-foreground",
  success: "bg-success/12 text-success ring-1 ring-success/25",
  warning: "bg-warning/14 text-warning ring-1 ring-warning/25",
  danger: "bg-danger/12 text-danger ring-1 ring-danger/25",
};

export function Badge({
  className,
  variant = "muted",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
