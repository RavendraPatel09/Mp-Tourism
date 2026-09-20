"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";
import { useSaved } from "@/store/saved";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DestinationCard } from "./destination-card";
import type { DestinationSummary } from "@/lib/types";

export function SavedClient({ all }: { all: DestinationSummary[] }) {
  const slugs = useSaved((s) => s.slugs);
  const clear = useSaved((s) => s.clear);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const saved = all.filter((d) => slugs.includes(d.slug));
  const totalPoints = saved.reduce((sum, d) => sum + d.basePoints, 0);

  if (saved.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark className="size-8" />}
        title="Nothing saved yet"
        description="Tap Save on any destination and it lands here. One flat list at MVP — custom lists arrive in Phase 2."
        action={
          <Link
            href="/explore"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Explore destinations
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{saved.length}</span>{" "}
          saved ·{" "}
          <span className="font-semibold text-accent">{totalPoints} points</span>{" "}
          on the table if you check in at all of them
        </p>
        <Button variant="ghost" size="sm" onClick={clear} className="ml-auto gap-1.5">
          <Trash2 className="size-3.5" aria-hidden />
          Clear list
        </Button>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {saved.map((d) => (
          <DestinationCard key={d.slug} destination={d} />
        ))}
      </div>
    </div>
  );
}
