"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSaved } from "@/store/saved";
import { cn } from "@/lib/utils";

export function SaveButton({
  slug,
  className,
  label = true,
}: {
  slug: string;
  className?: string;
  label?: boolean;
}) {
  const slugs = useSaved((s) => s.slugs);
  const toggle = useSaved((s) => s.toggle);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const saved = mounted && slugs.includes(slug);

  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={saved}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors",
        saved ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-muted",
        className,
      )}
    >
      {saved ? (
        <BookmarkCheck className="size-4" aria-hidden />
      ) : (
        <Bookmark className="size-4" aria-hidden />
      )}
      {label ? (saved ? "Saved" : "Save") : null}
      <span className="sr-only">
        {saved ? "Remove from saved places" : "Save to your places"}
      </span>
    </button>
  );
}
