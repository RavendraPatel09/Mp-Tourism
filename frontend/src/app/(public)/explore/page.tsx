import type { Metadata } from "next";
import { Suspense } from "react";
import { parseDestinationQuery } from "@/lib/api/params";
import { serverApi } from "@/lib/api/server";
import { ExploreResults } from "@/components/public/explore-results";
import { FilterRail } from "@/components/public/filter-rail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Explore destinations in India",
  description:
    "Filter India's destinations by interest, time available, difficulty, season and points tier. Tier 4 sites — under 20,000 visitors a year — are worth 150 points each.",
  alternates: { canonical: "/explore" },
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = parseDestinationQuery(sp);

  const [initialData, categories, districts] = await Promise.all([
    serverApi.destinations(query),
    serverApi.categories(),
    serverApi.districts("MP"),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Explore destinations
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Twenty-nine curated destinations across Madhya Pradesh, sorted by
          default so the least-visited come first. That ordering is deliberate.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[17rem_1fr]">
        <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
          <FilterRail
            categories={categories}
            districts={districts}
            className="lg:sticky lg:top-24 lg:self-start"
          />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
          <ExploreResults initialData={initialData} />
        </Suspense>
      </div>
    </div>
  );
}
