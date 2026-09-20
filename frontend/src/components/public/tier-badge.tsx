import { Sparkles } from "lucide-react";
import { TIER_CLASS, TIER_META, TIER_POINTS } from "@/lib/points";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TierBadge({
  tier,
  className,
  showLabel = true,
}: {
  tier: Tier;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1",
        TIER_CLASS[tier],
        className,
      )}
    >
      {showLabel ? TIER_META[tier].label : `T${tier}`}
    </span>
  );
}

/**
 * The points pill. Deliberately prominent on Tier 3 and 4 — the number is the
 * argument for going somewhere you have not heard of.
 */
export function PointsPill({
  tier,
  points,
  className,
  size = "md",
}: {
  tier: Tier;
  points?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const value = points ?? TIER_POINTS[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ring-1",
        TIER_CLASS[tier],
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3.5 py-1.5 text-sm",
        className,
      )}
    >
      <Sparkles aria-hidden className={size === "lg" ? "size-4" : "size-3"} />
      {value} pts
    </span>
  );
}
