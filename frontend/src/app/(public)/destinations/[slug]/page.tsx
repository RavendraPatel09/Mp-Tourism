import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Accessibility,
  ArrowRight,
  Baby,
  Clock,
  Compass,
  ExternalLink,
  Leaf,
  MapPin,
  Mountain,
  Navigation,
  PersonStanding,
  Sparkles,
  Wallet,
} from "lucide-react";
import { serverApi } from "@/lib/api/server";
import {
  CROWD_LABEL,
  DIFFICULTY_LABEL,
  SEASON_LABEL,
  formatDuration,
  formatInr,
} from "@/lib/format";
import { TIER_META } from "@/lib/points";
import { categoryBySlug } from "@/mocks/seed/categories";
import { listAllDestinations } from "@/mocks/db";
import { CrowdIndicator } from "@/components/public/crowd-indicator";
import { DestinationCardCompact } from "@/components/public/destination-card";
import { ItineraryTimeline } from "@/components/public/itinerary-timeline";
import { Photo } from "@/components/public/photo";
import { ReviewList } from "@/components/public/reviews";
import { SaveButton } from "@/components/public/save-button";
import { PointsPill, TierBadge } from "@/components/public/tier-badge";
import { ThingsToDoList } from "@/components/public/things-to-do";
import { VisitorInfoAccordion } from "@/components/public/visitor-info";
import { Skeleton } from "@/components/ui/skeleton";

const MapView = dynamic(
  () => import("@/components/public/map-view").then((m) => m.MapView),
  { loading: () => <Skeleton className="h-full w-full" /> },
);

export const revalidate = 3600;

export function generateStaticParams() {
  return listAllDestinations().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = await serverApi.destination(slug);
  if (!d) return { title: "Destination not found" };

  const title = `${d.name}, ${d.district} — things to do, itinerary & visitor info`;
  const description = `${d.shortDescription} ${formatDuration(d.recommendedDurationMin)} recommended. Worth ${d.basePoints} points on YatraGo.`;

  return {
    title,
    description,
    alternates: { canonical: `/destinations/${d.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/destinations/${d.slug}`,
    },
  };
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = await serverApi.destination(slug);
  if (!destination) notFound();

  const [nearby25, nearby100, reviews] = await Promise.all([
    serverApi.nearby(slug, 25),
    serverApi.nearby(slug, 100),
    serverApi.reviews(slug),
  ]);
  const d = destination;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: d.name,
    description: d.shortDescription,
    address: {
      "@type": "PostalAddress",
      addressLocality: d.district,
      addressRegion: d.stateName,
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: d.location.lat,
      longitude: d.location.lng,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: d.rating,
      reviewCount: d.reviewCount,
      bestRating: 5,
    },
    isAccessibleForFree: d.info.entryFees.every((f) => f.amountInr === 0),
    publicAccess: true,
    touristType: d.categories.map((c) => categoryBySlug.get(c)?.name ?? c),
    ...(d.info.officialUrl ? { sameAs: d.info.officialUrl } : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "India", item: "/states" },
      { "@type": "ListItem", position: 2, name: d.stateName, item: `/states/${d.stateCode}` },
      { "@type": "ListItem", position: 3, name: d.name, item: `/destinations/${d.slug}` },
    ],
  };

  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${d.location.lat},${d.location.lng}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* ------------------------------------------------------- hero gallery */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/states" className="hover:underline">India</Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/states/${d.stateCode}`} className="hover:underline">
                  {d.stateName}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/explore?district=${encodeURIComponent(d.district)}`}
                  className="hover:underline"
                >
                  {d.district}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-foreground">{d.name}</li>
            </ol>
          </nav>

          <div className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted sm:col-span-2 sm:row-span-2 sm:aspect-auto">
              <Photo
                media={d.gallery[0]}
                tier={d.tier}
                alt={d.name}
                priority
                credit
                sizes="(max-width: 640px) 100vw, 50vw"
              />
            </div>
            {d.gallery.slice(1, 5).map((m) => (
              <div
                key={m.id}
                className="relative hidden aspect-[4/3] overflow-hidden rounded-xl bg-muted sm:block"
              >
                <Photo media={m} tier={d.tier} alt={m.caption ?? d.name} sizes="25vw" />
              </div>
            ))}
          </div>

          {d.gallery[0].licence !== "TBD" ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Hero photograph by {d.gallery[0].attribution} ({d.gallery[0].licence})
              {d.gallery[0].sourceUrl ? (
                <>
                  {" · "}
                  <a
                    href={d.gallery[0].sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener license"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    source
                  </a>
                </>
              ) : null}
              . Remaining gallery slots await licensed imagery.
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Imagery pending licence — the content pipeline clears rights and
              attribution before a photo goes live.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ header */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={d.tier} />
              {d.isEcoSensitive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-success/25">
                  <Leaf className="size-3" aria-hidden />
                  Eco-sensitive
                </span>
              ) : null}
              {d.crowdLevel === "at_capacity" ? (
                <span className="rounded-full bg-danger/12 px-2.5 py-0.5 text-xs font-medium text-danger ring-1 ring-danger/25">
                  High pressure site
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {d.name}
            </h1>

            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" aria-hidden />
              {d.district} district, {d.stateName}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {d.categories.map((c) => (
                <Link
                  key={c}
                  href={`/explore?categories=${c}`}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  {categoryBySlug.get(c)?.name ?? c}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <SaveButton slug={d.slug} />
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Navigation className="size-4" aria-hidden />
              Directions
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        </div>

        {/* ------------------------------------------------------ quick facts */}
        <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-(--radius-card) border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              icon: <Clock className="size-4" />,
              label: "Recommended",
              value: formatDuration(d.recommendedDurationMin),
              sub: `min ${formatDuration(d.minDurationMin)}`,
            },
            {
              icon: <Mountain className="size-4" />,
              label: "Difficulty",
              value: DIFFICULTY_LABEL[d.difficulty],
            },
            {
              icon: <Compass className="size-4" />,
              label: "Best season",
              value: SEASON_LABEL[d.bestSeasons[0]].split(" (")[0],
              sub: d.bestSeasons.length > 1 ? `+${d.bestSeasons.length - 1} more` : undefined,
            },
            {
              icon: <Wallet className="size-4" />,
              label: "Typical spend",
              value: formatInr(d.avgBudgetInr),
              sub: "per person",
            },
            {
              icon: <Sparkles className="size-4" />,
              label: "Check-in worth",
              value: `${d.basePoints} pts`,
              sub: TIER_META[d.tier].label.split(" · ")[1],
            },
            {
              icon: <PersonStanding className="size-4" />,
              label: "Crowds",
              value: CROWD_LABEL[d.crowdLevel],
            },
          ].map((f) => (
            <div key={f.label} className="bg-card p-4">
              <dt className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {f.icon}
                {f.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold">{f.value}</dd>
              {f.sub ? (
                <dd className="text-xs text-muted-foreground">{f.sub}</dd>
              ) : null}
            </div>
          ))}
        </dl>

        {/* ---------------------------------------------------------- columns */}
        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-12">
            <section aria-labelledby="why-go">
              <h2 id="why-go" className="text-xl font-semibold tracking-tight">
                Why go
              </h2>
              <p className="prose-trail mt-3 text-[15px] leading-relaxed">{d.whyGo}</p>
              <p className="prose-trail mt-4 text-[15px] leading-relaxed text-muted-foreground">
                {d.story}
              </p>
            </section>

            <ThingsToDoList items={d.thingsToDo} />

            <ItineraryTimeline itinerary={d.itinerary} />

            {/* ------------------------------------------------------ location */}
            <section aria-labelledby="location-heading">
              <h2 id="location-heading" className="text-xl font-semibold tracking-tight">
                Location &amp; geofence
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                The shaded ring is the check-in geofence — {d.geofenceRadiusM} m
                around the site. Your GPS has to fall inside it for a check-in to
                count.
              </p>
              <div className="mt-4 h-80 overflow-hidden rounded-(--radius-card) border border-border">
                <MapView
                  pins={[
                    {
                      slug: d.slug,
                      name: d.name,
                      tier: d.tier,
                      district: d.district,
                      location: d.location,
                    },
                  ]}
                  center={d.location}
                  zoom={13}
                  fitToPins={false}
                  geofence={{
                    centre: d.location,
                    radiusM: d.geofenceRadiusM,
                    polygon: d.geofencePolygon,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {d.location.lat.toFixed(4)}, {d.location.lng.toFixed(4)} ·{" "}
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Open turn-by-turn in Google Maps
                </a>
              </p>
            </section>

            <VisitorInfoAccordion info={d.info} />

            {/* ------------------------------------------------- accessibility */}
            <section aria-labelledby="accessibility-heading">
              <h2 id="accessibility-heading" className="text-xl font-semibold tracking-tight">
                Accessibility
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: <Accessibility className="size-4" />, label: "Wheelchair", value: d.accessibility.wheelchair },
                  { icon: <PersonStanding className="size-4" />, label: "Senior friendly", value: d.accessibility.seniorFriendly },
                  { icon: <Baby className="size-4" />, label: "Child friendly", value: d.accessibility.childFriendly },
                ].map((a) => (
                  <li
                    key={a.label}
                    className="flex items-center gap-2.5 rounded-xl border border-border p-3.5 text-sm"
                  >
                    <span className={a.value ? "text-success" : "text-muted-foreground"}>
                      {a.icon}
                    </span>
                    <span>
                      <span className="block font-medium">{a.label}</span>
                      <span className={`block text-xs ${a.value ? "text-success" : "text-muted-foreground"}`}>
                        {a.value ? "Yes" : "No"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {d.accessibility.notes ? (
                <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {d.accessibility.notes}
                </p>
              ) : null}
            </section>

            <ReviewList reviews={reviews} rating={d.rating} reviewCount={d.reviewCount} />
          </div>

          {/* ----------------------------------------------------- sidebar */}
          <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-(--radius-card) border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">What a check-in here is worth</h2>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className="text-4xl font-semibold tabular-nums"
                  style={{ color: `var(--color-tier-${d.tier})` }}
                >
                  {d.basePoints}
                </span>
                <span className="text-sm text-muted-foreground">points</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{d.pointsRationale}</p>
              <Link
                href="/points"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                How tiers are set
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>

            <div className="rounded-(--radius-card) border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Crowd &amp; capacity</h2>
              <div className="mt-3">
                <CrowdIndicator level={d.crowdLevel} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {d.crowdLevel === "at_capacity"
                  ? "This site is at or beyond its carrying capacity for much of the year. Consider the nearby destinations below — they are worth more points and they need the visitors."
                  : d.crowdLevel === "high"
                    ? "Busy in season and at weekends. Early morning is a materially different experience."
                    : d.crowdLevel === "moderate"
                      ? "Manageable most of the year. Weekday mornings are quietest."
                      : "Rarely crowded. You may well have it to yourself."}
              </p>
            </div>

            {nearby25.length > 0 ? (
              <NearbyBlock
                title="Within 25 km"
                subtitle="Same trip, no detour."
                items={nearby25}
              />
            ) : null}
          </aside>
        </div>

        {/* ---------------------------------------------------------- nearby */}
        {nearby100.length > 0 ? (
          <section className="mt-16 border-t border-border pt-10" aria-labelledby="nearby-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="nearby-heading" className="text-xl font-semibold tracking-tight">
                  Nearby, within 100 km
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  Ordered by tier before distance — the least-visited neighbours
                  come first. This list is the redistribution engine.
                </p>
              </div>
              <Link
                href={`/explore?district=${encodeURIComponent(d.district)}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                More in {d.district}
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {nearby100.map((n) => (
                <DestinationCardCompact key={n.slug} destination={n} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

function NearbyBlock({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Awaited<ReturnType<typeof serverApi.nearby>>;
}) {
  return (
    <div className="rounded-(--radius-card) border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      <ul className="mt-3 space-y-2.5">
        {items.slice(0, 4).map((n) => (
          <li key={n.slug}>
            <Link
              href={`/destinations/${n.slug}`}
              className="group flex items-center gap-3"
            >
              <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                <Photo media={n.heroImage} tier={n.tier} alt="" sizes="44px" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium group-hover:underline">
                  {n.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {n.distanceKm} km away
                </span>
              </span>
              <PointsPill tier={n.tier} points={n.basePoints} size="sm" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
