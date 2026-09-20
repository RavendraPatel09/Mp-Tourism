import Link from "next/link";
import {
  ArrowRight,
  Compass,
  MapPin,
  TrendingDown,
  Trophy,
} from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { formatCompact } from "@/lib/format";
import { TIER_META, TIER_POINTS } from "@/lib/points";
import { categories } from "@/mocks/seed/categories";
import { DestinationCard } from "@/components/public/destination-card";
import { Photo } from "@/components/public/photo";
import { PointsPill, TierBadge } from "@/components/public/tier-badge";
import type { Tier } from "@/lib/types";

export const revalidate = 3600;

const TIER_EXAMPLES: { tier: Tier; place: string }[] = [
  { tier: 1, place: "Khajuraho" },
  { tier: 2, place: "Orchha" },
  { tier: 3, place: "Bhojpur Temple" },
  { tier: 4, place: "Garhkundar Fort" },
];

export default async function HomePage() {
  const [tier4, top, circuits, states, leaders, activeChallenges] =
    await Promise.all([
      serverApi.destinations({ tier: [4], pageSize: 3 }),
      serverApi.destinations({ sort: "rating", pageSize: 6 }),
      serverApi.circuits(),
      serverApi.states(),
      serverApi.leaderboard({ scope: "national", period: "month", limit: 5 }),
      serverApi.challenges({ active: true }),
    ]);

  const liveStates = states.filter((s) => s.status === "live");

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-soft via-background to-background" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-3xl">
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Discover India, and get paid most for going{" "}
              <span className="text-accent">where nobody goes</span>.
            </h1>

            <p className="prose-trail mt-5 text-lg text-muted-foreground">
              Pick a state, pick what you are into — forts, waterfalls, temples,
              wildlife, weaving — and get the places worth going, the things to
              actually do there, hour-by-hour itineraries and the practical
              information you would otherwise hunt across six blogs for.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/explore"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Start exploring <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/explore?tier=4&sort=points"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-card px-6 text-base font-medium hover:bg-muted"
              >
                <Compass className="size-4" aria-hidden />
                Show me the Tier 4 places
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------- the inverted points idea */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-accent uppercase">
                <TrendingDown className="size-4" aria-hidden />
                The idea that makes this different
              </span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
                Points are inverted against popularity.
              </h2>
              <p className="prose-trail mt-4 text-muted-foreground">
                The Taj Mahal does not need your footfall. An unlisted fort forty
                kilometres off the highway does — and so does the homestay, the
                guide and the dhaba next to it.
              </p>
              <p className="prose-trail mt-3 text-muted-foreground">
                So a check-in at a marquee site is worth 10 points, and one at a
                place under twenty thousand visitors a year is worth 150. Tiers
                are recomputed every quarter, which means a destination that
                becomes popular <em>drops</em> in value. The incentive
                permanently chases the long tail.
              </p>
              <Link
                href="/points"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                How the points engine works
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>

            <ul className="space-y-3">
              {TIER_EXAMPLES.map(({ tier, place }) => (
                <li
                  key={tier}
                  className="flex items-center gap-4 rounded-(--radius-card) border border-border p-4"
                >
                  <TierBadge tier={tier} showLabel={false} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{place}</p>
                    <p className="text-xs text-muted-foreground">
                      {TIER_META[tier].definition}
                    </p>
                  </div>
                  <span
                    className="text-2xl font-semibold tabular-nums"
                    style={{ color: `var(--color-tier-${tier})` }}
                  >
                    {TIER_POINTS[tier]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Tier 4 spotlight */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Tier 4 — worth 150 points each
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Remote, newly listed or simply undocumented. Every one of these
              sits within a hundred kilometres of somewhere that takes ten to a
              hundred times the visitors.
            </p>
          </div>
          <Link
            href="/explore?tier=4"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            See all Tier 4 <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tier4.items.map((d, i) => (
            <DestinationCard key={d.slug} destination={d} priority={i === 0} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- categories */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            What are you into?
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Multi-select, and stack it with time available, difficulty and season.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/explore?categories=${c.slug}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- circuits */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Curated circuits
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Multi-day routes built so the highest-scoring stops come last.
            </p>
          </div>
          <Link
            href="/circuits"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            All circuits <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {circuits.slice(0, 3).map((c) => (
            <article
              key={c.slug}
              className="group relative overflow-hidden rounded-(--radius-card) border border-border bg-card"
            >
              <div className="relative aspect-[16/9] bg-muted">
                <Photo media={c.heroImage} tier={4} alt={c.name} credit scrim sizes="33vw" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold">
                  <Link
                    href={`/circuits/${c.slug}`}
                    className="after:absolute after:inset-0 hover:underline"
                  >
                    {c.name}
                  </Link>
                </h3>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                  {c.description}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{c.dayCount} days</span>
                  <span>{c.destinationSlugs.length} stops</span>
                  <span>{c.totalDistanceKm} km</span>
                  <span className="ml-auto font-semibold text-accent">
                    {c.totalPoints} pts
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------------------- challenges + leaderboard */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Challenges running now
            </h2>
            <ul className="mt-5 space-y-3">
              {activeChallenges.slice(0, 3).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/challenges/${c.slug}`}
                    className="flex items-start gap-4 rounded-(--radius-card) border border-border p-4 transition-colors hover:bg-muted/50"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
                      <Trophy className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{c.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                        {c.description}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {c.multiplier > 1 ? (
                          <span className="rounded-full bg-accent/12 px-2 py-0.5 font-semibold text-accent">
                            {c.multiplier}× points
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">
                          {formatCompact(c.participantCount)} taking part
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">
                This month&apos;s leaders
              </h2>
              <Link
                href="/leaderboards"
                className="text-sm font-medium text-primary hover:underline"
              >
                Full board
              </Link>
            </div>
            <ol className="mt-5 divide-y divide-border rounded-(--radius-card) border border-border">
              {leaders.map((e) => (
                <li key={e.username} className="flex items-center gap-3 p-3.5">
                  <span className="w-6 text-sm font-semibold tabular-nums text-muted-foreground">
                    {e.rank}
                  </span>
                  <span
                    aria-hidden
                    className="grid size-9 place-items-center rounded-full text-xs font-bold text-white"
                    style={{ background: e.avatarColor }}
                  >
                    {e.displayName.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/u/${e.username}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {e.displayName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {e.levelName} · {Math.round(e.tier34Share * 100)}% Tier 3+4
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCompact(e.points)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ state hubs */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Where do you want to go?
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {liveStates.map((s) => (
            <Link
              key={s.code}
              href={`/states/${s.code}`}
              className="group flex items-center gap-4 rounded-(--radius-card) border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary">
                <MapPin className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{s.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {s.destinationCount} destinations · {s.tagline}
                </span>
              </span>
              <PointsPill tier={4} size="sm" />
            </Link>
          ))}
          <Link
            href="/states"
            className="flex items-center justify-center gap-2 rounded-(--radius-card) border border-dashed border-border p-5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            All 28 states and 8 union territories
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* --------------------------------------------------------- top rated */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Highest rated by explorers who have been
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every rating comes from someone with a verified check-in at that
            destination. That is the only way to leave one.
          </p>
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {top.items.slice(0, 6).map((d) => (
              <DestinationCard key={d.slug} destination={d} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
