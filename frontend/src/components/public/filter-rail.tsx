"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  countActiveFilters,
  parseDestinationQuery,
  serializeDestinationQuery,
} from "@/lib/api/params";
import { DIFFICULTY_LABEL, DURATION_BUCKETS, SEASON_LABEL } from "@/lib/format";
import { TIER_META, TIER_POINTS } from "@/lib/points";
import type { Category, Difficulty, District, Season, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIFFICULTIES: Difficulty[] = ["easy", "moderate", "challenging", "strenuous"];
const SEASONS: Season[] = ["winter", "summer", "monsoon", "post_monsoon"];
const TIERS: Tier[] = [4, 3, 2, 1];

function Group({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <legend className="text-xs font-semibold tracking-wider uppercase">
        {legend}
      </legend>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  children,
  style,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={style}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Filters live in the URL, not in component state — a filtered view is then
 * shareable, bookmarkable, back-button-safe and indexable, which matters
 * because "places to visit in X, for Y" is the acquisition channel.
 */
export function FilterRail({
  categories,
  districts,
  className,
}: {
  categories: Category[];
  districts: District[];
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = parseDestinationQuery(new URLSearchParams(searchParams.toString()));
  const activeCount = countActiveFilters(query);

  const update = React.useCallback(
    (patch: Partial<ReturnType<typeof parseDestinationQuery>>) => {
      const next = { ...query, ...patch, page: 1 };
      const qs = serializeDestinationQuery(next).toString();
      router.replace(qs ? `/explore?${qs}` : "/explore", { scroll: false });
    },
    [query, router],
  );

  function toggleIn<T>(list: T[] | undefined, value: T): T[] {
    const arr = list ?? [];
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  return (
    <aside className={cn("text-sm", className)} aria-label="Filters">
      <div className="flex items-center justify-between gap-2 pb-4">
        <h2 className="inline-flex items-center gap-2 font-semibold">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
          {activeCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </h2>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => router.replace("/explore", { scroll: false })}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" aria-hidden />
            Clear all
          </button>
        ) : null}
      </div>

      <Group
        legend="Points tier"
        hint="Tier 4 is the long tail — remote, newly listed, under 20k visitors a year."
      >
        <div className="flex flex-wrap gap-2">
          {TIERS.map((t) => {
            const active = query.tier?.includes(t) ?? false;
            return (
              <Chip
                key={t}
                active={active}
                onClick={() => update({ tier: toggleIn(query.tier, t) })}
                style={
                  active
                    ? {
                        background: `var(--color-tier-${t})`,
                        borderColor: `var(--color-tier-${t})`,
                        color: "#fff",
                      }
                    : undefined
                }
              >
                {TIER_META[t].label.split(" · ")[1]} · {TIER_POINTS[t]} pts
              </Chip>
            );
          })}
        </div>
      </Group>

      <Group legend="Interests">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Chip
              key={c.slug}
              active={query.categories?.includes(c.slug) ?? false}
              onClick={() => update({ categories: toggleIn(query.categories, c.slug) })}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </Group>

      <Group legend="Time available">
        <div className="flex flex-wrap gap-2">
          {DURATION_BUCKETS.map((b) => (
            <Chip
              key={b.value}
              active={query.duration === b.value}
              onClick={() =>
                update({ duration: query.duration === b.value ? undefined : b.value })
              }
            >
              {b.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group legend="Difficulty">
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => (
            <Chip
              key={d}
              active={query.difficulty?.includes(d) ?? false}
              onClick={() => update({ difficulty: toggleIn(query.difficulty, d) })}
            >
              {DIFFICULTY_LABEL[d]}
            </Chip>
          ))}
        </div>
      </Group>

      <Group legend="Best season">
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((s) => (
            <Chip
              key={s}
              active={query.season === s}
              onClick={() => update({ season: query.season === s ? undefined : s })}
            >
              {SEASON_LABEL[s].split(" (")[0]}
            </Chip>
          ))}
        </div>
      </Group>

      <Group legend="District">
        <select
          value={query.district ?? ""}
          onChange={(e) => update({ district: e.target.value || undefined })}
          aria-label="District"
          className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm"
        >
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name} ({d.destinationCount})
            </option>
          ))}
        </select>
      </Group>

      <Group legend="Accessibility">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={query.accessible ?? false}
            onChange={(e) => update({ accessible: e.target.checked || undefined })}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span className="text-sm">
            Wheelchair accessible
            <span className="block text-xs text-muted-foreground">
              Sites with a step-free route to the main viewing area.
            </span>
          </span>
        </label>
      </Group>
    </aside>
  );
}
