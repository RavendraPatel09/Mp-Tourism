import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { CalendarDays, Route, Sparkles } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { circuits } from "@/mocks/seed/circuits";
import { DestinationCard } from "@/components/public/destination-card";
import { Photo } from "@/components/public/photo";
import { PointsPill } from "@/components/public/tier-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DestinationSummary } from "@/lib/types";

const MapView = dynamic(
  () => import("@/components/public/map-view").then((m) => m.MapView),
  { loading: () => <Skeleton className="h-full w-full" /> },
);

export const revalidate = 3600;

export function generateStaticParams() {
  return circuits.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await serverApi.circuit(slug);
  if (!c) return { title: "Circuit not found" };
  return {
    title: `${c.name} — ${c.dayCount}-day route, ${c.destinationSlugs.length} stops`,
    description: c.description,
    alternates: { canonical: `/circuits/${c.slug}` },
  };
}

export default async function CircuitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const circuit = await serverApi.circuit(slug);
  if (!circuit) notFound();

  const stops = (
    await Promise.all(circuit.destinationSlugs.map((s) => serverApi.destination(s)))
  ).filter((d): d is NonNullable<typeof d> => Boolean(d));

  const summaries: DestinationSummary[] = stops.map((d) => ({
    ...d,
  }));

  return (
    <div>
      <section className="relative border-b border-border">
        <div className="relative h-64 bg-muted sm:h-80">
          <Photo media={circuit.heroImage} tier={4} alt={circuit.name} priority credit scrim sizes="100vw" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/circuits" className="hover:underline">
              Circuits
            </Link>
            <span aria-hidden> / </span>
            <span className="text-foreground">{circuit.name}</span>
          </nav>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {circuit.name}
          </h1>
          <p className="prose-trail mt-3 text-muted-foreground">
            {circuit.description}
          </p>

          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            {[
              { icon: <CalendarDays className="size-4" />, label: "Duration", value: `${circuit.dayCount} days` },
              { icon: <Route className="size-4" />, label: "Distance", value: `${circuit.totalDistanceKm} km` },
              { icon: <Sparkles className="size-4" />, label: "Check-in points", value: `${circuit.totalPoints} pts` },
            ].map((s) => (
              <div key={s.label}>
                <dt className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  {s.icon}
                  {s.label}
                </dt>
                <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <section aria-labelledby="route-heading">
          <h2 id="route-heading" className="text-xl font-semibold tracking-tight">
            The route
          </h2>
          <div className="mt-4 h-96 overflow-hidden rounded-(--radius-card) border border-border">
            <MapView
              pins={summaries.map((d) => ({
                slug: d.slug,
                name: d.name,
                tier: d.tier,
                district: d.district,
                location: d.location,
              }))}
              routeOrder={circuit.destinationSlugs}
            />
          </div>
        </section>

        <section className="mt-12" aria-labelledby="stops-heading">
          <h2 id="stops-heading" className="text-xl font-semibold tracking-tight">
            Stops, in order
          </h2>
          <ol className="mt-5 space-y-3">
            {summaries.map((d, i) => (
              <li
                key={d.slug}
                className="group relative flex items-center gap-4 rounded-(--radius-card) border border-border bg-card p-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Photo media={d.heroImage} tier={d.tier} alt="" sizes="64px" />
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/destinations/${d.slug}`}
                    className="block font-semibold after:absolute after:inset-0 hover:underline"
                  >
                    {d.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {d.district} · {d.stateName}
                  </span>
                  <span className="mt-1 block line-clamp-1 text-sm text-muted-foreground">
                    {d.shortDescription}
                  </span>
                </span>
                <PointsPill tier={d.tier} points={d.basePoints} />
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="detail-heading">
          <h2 id="detail-heading" className="text-xl font-semibold tracking-tight">
            Each stop in detail
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((d) => (
              <DestinationCard key={d.slug} destination={d} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
