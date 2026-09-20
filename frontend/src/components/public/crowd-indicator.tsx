import { Users } from "lucide-react";
import { CROWD_LABEL } from "@/lib/format";
import type { CrowdLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE: Record<CrowdLevel, string> = {
  low: "text-success",
  moderate: "text-muted-foreground",
  high: "text-warning",
  at_capacity: "text-danger",
};

const BARS: Record<CrowdLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  at_capacity: 4,
};

/** PRD F21 — carrying capacity has to be visible, not buried in the copy. */
export function CrowdIndicator({
  level,
  className,
  showLabel = true,
}: {
  level: CrowdLevel;
  className?: string;
  showLabel?: boolean;
}) {
  const filled = BARS[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", TONE[level], className)}>
      <Users aria-hidden className="size-3.5" />
      <span aria-hidden className="inline-flex items-end gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "w-1 rounded-sm bg-current",
              i <= filled ? "opacity-100" : "opacity-25",
            )}
            style={{ height: `${4 + i * 2}px` }}
          />
        ))}
      </span>
      {showLabel ? <span className="font-medium">{CROWD_LABEL[level]}</span> : null}
      <span className="sr-only">{CROWD_LABEL[level]}</span>
    </span>
  );
}
