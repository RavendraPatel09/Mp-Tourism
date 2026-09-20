/**
 * YatraGo brand mark.
 *
 * The mark is a Y read as a fork in the road: a single path rises, splits, and
 * one branch runs on to a destination marker. The faded branch is the road
 * everyone already takes; the solid one ending in the marker is the road that
 * scores 150 points. The product thesis is the logo — that is the whole idea.
 *
 * Geometry is tuned to stay legible at 16px, so the marker is deliberately
 * oversized relative to the stroke weight.
 */

import { cn } from "@/lib/utils";

export function LogoMark({
  className,
  duotone = true,
  title,
}: {
  className?: string;
  /** Colour the divergent branch with the accent token. Off = single colour. */
  duotone?: boolean;
  /** Set only when the mark stands alone without an adjacent wordmark. */
  title?: string;
}) {
  const branch = duotone ? "var(--accent)" : "currentColor";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}

      {/* the shared road */}
      <path
        d="M12 20.6V12.4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* the way everyone already goes */}
      <path
        d="M12 12.4 7 7.4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* the way that scores */}
      <path
        d="M12 12.4 16.4 8"
        stroke={branch}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="17.2" cy="7.2" r="2.7" fill={branch} />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-7 text-primary", markClassName)} />
      <span className="text-[1.0625rem] font-semibold tracking-tight">
        Yatra<span className="text-accent">Go</span>
      </span>
    </span>
  );
}
