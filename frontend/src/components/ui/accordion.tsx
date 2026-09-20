"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Accordion({
  items,
  defaultOpen = [],
  className,
}: {
  items: { id: string; title: React.ReactNode; content: React.ReactNode }[];
  defaultOpen?: string[];
  className?: string;
}) {
  const [open, setOpen] = React.useState<Set<string>>(new Set(defaultOpen));

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={cn("divide-y divide-border", className)}>
      {items.map((item) => {
        const isOpen = open.has(item.id);
        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
                aria-controls={`panel-${item.id}`}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium"
              >
                {item.title}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
            </h3>
            <div
              id={`panel-${item.id}`}
              hidden={!isOpen}
              className="pb-5 text-sm text-muted-foreground"
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
