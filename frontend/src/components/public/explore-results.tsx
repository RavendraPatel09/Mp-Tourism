"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { LayoutGrid, Map as MapIcon, SearchX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { parseDestinationQuery, serializeDestinationQuery } from "@/lib/api/params";
import { formatNumber } from "@/lib/format";
import type { DestinationSummary, Paginated } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DestinationCard, DestinationCardCompact } from "./destination-card";
import { toPins } from "./map-view";

// MapLibre touches `window` at import time, so it never runs on the server.
const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "points", label: "Highest points" },
  { value: "rating", label: "Top rated" },
  { value: "duration", label: "Quickest visit" },
] as const;

export function ExploreResults({
  initialData,
}: {
  initialData: Paginated<DestinationSummary>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const query = React.useMemo(
    () => parseDestinationQuery(new URLSearchParams(qs)),
    [qs],
  );

  const [view, setView] = React.useState<"grid" | "map">("grid");
  const [activeSlug, setActiveSlug] = React.useState<string>();

  const { data, isFetching } = useQuery({
    queryKey: ["destinations", qs],
    queryFn: () => api.destinations(query),
    initialData: qs === "" ? initialData : undefined,
    placeholderData: (prev) => prev,
  });

  // The map needs the whole result set, not just the current page of cards.
  const { data: mapData } = useQuery({
    queryKey: ["destinations-map", qs],
    queryFn: () => api.destinations({ ...query, page: 1, pageSize: 60 }),
    enabled: view === "map",
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  function setSort(sort: string) {
    const next = serializeDestinationQuery({
      ...query,
      sort: sort as typeof query.sort,
      page: 1,
    }).toString();
    router.replace(next ? `/explore?${next}` : "/explore", { scroll: false });
  }

  function goToPage(page: number) {
    const next = serializeDestinationQuery({ ...query, page }).toString();
    router.replace(next ? `/explore?${next}` : "/explore", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const tier34 = rows.filter((d) => d.tier >= 3).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">{formatNumber(total)}</span>{" "}
          {total === 1 ? "destination" : "destinations"}
          {rows.length > 0 ? (
            <span className="hidden sm:inline">
              {" "}
              · {tier34} of {rows.length} on this page are Tier 3 or 4
            </span>
          ) : null}
          {isFetching ? <span className="ml-2 opacity-60">updating…</span> : null}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            value={query.sort ?? "recommended"}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-lg border border-border bg-input px-2.5 text-sm"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              className={`grid size-8 place-items-center rounded-md ${view === "grid" ? "bg-muted" : ""}`}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              aria-pressed={view === "map"}
              aria-label="Map view"
              className={`grid size-8 place-items-center rounded-md ${view === "map" ? "bg-muted" : ""}`}
            >
              <MapIcon className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 && !isFetching ? (
        <EmptyState
          className="mt-8"
          icon={<SearchX className="size-8" />}
          title="Nothing matches all of those filters"
          description="Try dropping the season or difficulty filter — the catalogue is 29 destinations at MVP, so narrow combinations run out fast."
          action={
            <Button variant="outline" onClick={() => router.replace("/explore")}>
              Clear all filters
            </Button>
          }
        />
      ) : view === "map" ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="h-[32rem] lg:h-[40rem]">
            <MapView
              pins={toPins(mapData?.items ?? rows)}
              activeSlug={activeSlug}
              onSelect={(slug) => setActiveSlug(slug)}
            />
          </div>
          <div className="max-h-[40rem] space-y-2 overflow-y-auto pr-1">
            {(mapData?.items ?? rows).map((d) => (
              <div
                key={d.slug}
                onMouseEnter={() => setActiveSlug(d.slug)}
                onMouseLeave={() => setActiveSlug(undefined)}
              >
                <DestinationCardCompact destination={d} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((d, i) => (
              <DestinationCard key={d.slug} destination={d} priority={i < 3} />
            ))}
          </div>

          {(data?.totalPages ?? 1) > 1 ? (
            <nav
              aria-label="Pagination"
              className="mt-10 flex items-center justify-center gap-2"
            >
              <Button
                variant="outline"
                size="sm"
                disabled={(data?.page ?? 1) <= 1}
                onClick={() => goToPage((data?.page ?? 1) - 1)}
              >
                Previous
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
                Page {data?.page} of {data?.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(data?.page ?? 1) >= (data?.totalPages ?? 1)}
                onClick={() => goToPage((data?.page ?? 1) + 1)}
              >
                Next
              </Button>
            </nav>
          ) : null}
        </>
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Not finding it?{" "}
        <Link href="/search" className="font-medium text-primary hover:underline">
          Search by name
        </Link>{" "}
        — spelling variants like &ldquo;Khajurao&rdquo; and &ldquo;Mandav&rdquo; work.
      </p>
    </div>
  );
}
