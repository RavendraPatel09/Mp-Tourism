"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { initials } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Scope = "national" | "state";
type Period = "month" | "all";

function Row({ e, highlight }: { e: LeaderboardEntry; highlight?: boolean }) {
  const medal = e.rank <= 3;
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        highlight && "bg-primary-soft",
      )}
    >
      <span
        className={cn(
          "w-8 shrink-0 text-sm font-semibold tabular-nums",
          medal ? "text-accent" : "text-muted-foreground",
        )}
      >
        {e.rank}
      </span>

      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
        style={{ background: e.avatarColor }}
      >
        {initials(e.displayName)}
      </span>

      <span className="min-w-0 flex-1">
        <Link
          href={`/u/${e.username}`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {e.displayName}
          {highlight ? (
            <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              YOU
            </span>
          ) : null}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">
          @{e.username} · {e.levelName} · {e.stateCode}
        </span>
      </span>

      <span className="hidden w-28 shrink-0 text-right sm:block">
        <span className="block text-sm font-medium tabular-nums">
          {Math.round(e.tier34Share * 100)}%
        </span>
        <span className="block text-[11px] text-muted-foreground">Tier 3+4</span>
      </span>

      <span className="hidden w-20 shrink-0 text-right md:block">
        <span className="block text-sm tabular-nums">{e.checkIns}</span>
        <span className="block text-[11px] text-muted-foreground">check-ins</span>
      </span>

      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
        {formatNumber(e.points)}
      </span>
    </li>
  );
}

export function LeaderboardTable({
  initial,
}: {
  initial: LeaderboardEntry[];
}) {
  const [scope, setScope] = React.useState<Scope>("national");
  const [period, setPeriod] = React.useState<Period>("all");

  const { data, isFetching } = useQuery({
    queryKey: ["leaderboard", scope, period],
    queryFn: () => api.leaderboard({ scope, period, state: scope === "state" ? "MP" : undefined }),
    initialData: scope === "national" && period === "all" ? initial : undefined,
    placeholderData: (prev) => prev,
  });

  const rows = data ?? [];
  const me = rows.find((r) => r.isCurrentUser);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          ariaLabel="Leaderboard scope"
          value={scope}
          onChange={setScope}
          tabs={[
            { value: "national", label: "National" },
            { value: "state", label: "Madhya Pradesh" },
          ]}
        />
        <Tabs
          ariaLabel="Leaderboard period"
          value={period}
          onChange={setPeriod}
          tabs={[
            { value: "all", label: "All time" },
            { value: "month", label: "This month" },
          ]}
        />
        {isFetching ? (
          <span className="text-xs text-muted-foreground">updating…</span>
        ) : null}
      </div>

      <p className="mt-4 inline-flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Only the highest-value check-in per destination counts toward the board,
        and daily point caps apply. The Tier 3+4 column is the one worth reading.
      </p>

      {rows.length === 0 ? (
        <Skeleton className="mt-5 h-96 w-full" />
      ) : (
        <ol className="mt-5 divide-y divide-border overflow-hidden rounded-(--radius-card) border border-border bg-card">
          <li className="flex items-center gap-3 bg-muted/60 px-4 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <span className="w-8 shrink-0">#</span>
            <span className="size-9 shrink-0" aria-hidden />
            <span className="flex-1">Explorer</span>
            <Tooltip label="Share of this explorer's check-ins at Tier 3 and Tier 4 destinations">
              <span className="hidden w-28 shrink-0 cursor-help text-right sm:block">
                Long tail
              </span>
            </Tooltip>
            <span className="hidden w-20 shrink-0 text-right md:block">Visits</span>
            <span className="w-20 shrink-0 text-right">Points</span>
          </li>
          {rows.map((e) => (
            <Row key={e.username} e={e} highlight={e.isCurrentUser} />
          ))}
        </ol>
      )}

      {me ? (
        <div className="sticky bottom-4 mt-4 overflow-hidden rounded-(--radius-card) border border-primary bg-card shadow-lg">
          <ol>
            <Row e={me} highlight />
          </ol>
        </div>
      ) : null}
    </div>
  );
}
