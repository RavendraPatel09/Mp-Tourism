"use client";

import * as React from "react";
import { Check, Clock } from "lucide-react";
import { formatDuration } from "@/lib/format";
import type { ThingToDo } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * PRD F3 — "a concrete checklist, not prose".
 *
 * Ticking is local and unsynced; it exists so someone standing at the site can
 * keep their place, which is what the field actually gets used for.
 */
export function ThingsToDoList({ items }: { items: ThingToDo[] }) {
  const [done, setDone] = React.useState<Set<string>>(new Set());
  const total = items.reduce((sum, i) => sum + i.durationMin, 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Things to do here</h2>
        <p className="text-sm text-muted-foreground">
          {items.length} things · {formatDuration(total)} to do all of them
          {done.size > 0 ? ` · ${done.size} ticked` : ""}
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const checked = done.has(item.id);
          return (
            <li key={item.id}>
              <label
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border border-border p-4 transition-colors",
                  checked ? "bg-muted/60" : "hover:bg-muted/40",
                )}
              >
                <span className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDone((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 place-items-center rounded-md border transition-colors",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {checked ? <Check className="size-3.5" /> : null}
                  </span>
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      checked && "text-muted-foreground line-through",
                    )}
                  >
                    {item.title}
                  </span>
                  {item.description ? (
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  ) : null}
                </span>

                <span className="inline-flex shrink-0 items-center gap-1 self-start text-xs whitespace-nowrap text-muted-foreground">
                  <Clock className="size-3" aria-hidden />
                  {formatDuration(item.durationMin)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
