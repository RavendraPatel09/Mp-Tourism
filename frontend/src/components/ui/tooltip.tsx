import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * CSS-only hover/focus tooltip. Uses a real `title`-free pattern so it works
 * for keyboard users, and it is never the only place information lives.
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-xs whitespace-nowrap text-card-foreground shadow-lg group-hover/tt:block group-focus-within/tt:block"
      >
        {label}
      </span>
    </span>
  );
}
