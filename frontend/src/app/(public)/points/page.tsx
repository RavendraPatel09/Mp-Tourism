import type { Metadata } from "next";
import Link from "next/link";
import { Camera, MapPin, ShieldCheck, TrendingDown } from "lucide-react";
import { LEVELS, MULTIPLIERS, POINT_ACTIONS, TIER_META, TIER_POINTS } from "@/lib/points";
import { formatNumber } from "@/lib/format";
import type { Tier } from "@/lib/types";

export const metadata: Metadata = {
  title: "How points work",
  description:
    "Points on YatraGo are inverted against popularity — 10 for a marquee site, 150 for one under twenty thousand visitors a year. Tiers are recomputed quarterly.",
  alternates: { canonical: "/points" },
};

const TIERS: Tier[] = [1, 2, 3, 4];

export default function PointsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">How points work</h1>
      <p className="prose-trail mt-3 text-lg text-muted-foreground">
        Every scoring rule in this product exists to answer one question: how do
        you get people to the thousands of places that are worth going to and
        that nobody has heard of?
      </p>

      <section className="mt-12" aria-labelledby="tiers-heading">
        <h2 id="tiers-heading" className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
          <TrendingDown className="size-5 text-accent" aria-hidden />
          Tiers, inverted against popularity
        </h2>
        <p className="prose-trail mt-2 text-muted-foreground">
          A destination&apos;s tier is set by the platform from annual footfall,
          review volume and state board input — and{" "}
          <strong className="text-foreground">re-evaluated every quarter</strong>.
          A place that becomes popular drops in tier, so the incentive
          permanently chases the long tail rather than settling on a fixed list.
        </p>

        <ul className="mt-6 space-y-3">
          {TIERS.map((t) => (
            <li
              key={t}
              className="flex items-center gap-4 rounded-(--radius-card) border border-border bg-card p-4"
            >
              <span
                className="grid size-12 shrink-0 place-items-center rounded-xl text-lg font-bold"
                style={{
                  background: `color-mix(in srgb, var(--color-tier-${t}) 14%, transparent)`,
                  color: `var(--color-tier-${t})`,
                }}
              >
                T{t}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {TIER_META[t].label.split(" · ")[1]}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {TIER_META[t].definition} · e.g. {TIER_META[t].example}
                </span>
              </span>
              <span
                className="text-2xl font-semibold tabular-nums"
                style={{ color: `var(--color-tier-${t})` }}
              >
                {TIER_POINTS[t]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-xl font-semibold tracking-tight">
          Everything that scores
        </h2>
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-(--radius-card) border border-border">
          {POINT_ACTIONS.map((a) => (
            <li key={a.label} className="flex items-baseline justify-between gap-4 bg-card px-4 py-3">
              <span className="text-sm">{a.label}</span>
              <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                {"max" in a && a.max ? `${a.points}–${a.max}` : `+${a.points}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="multipliers-heading">
        <h2 id="multipliers-heading" className="text-xl font-semibold tracking-tight">
          Multipliers
        </h2>
        <p className="mt-2 text-muted-foreground">
          These stack on the base points. Off-season and monsoon multipliers
          exist to spread footfall across the calendar, not just across the map.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {MULTIPLIERS.map((m) => (
            <li
              key={m.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <span className="text-sm">{m.label}</span>
              <span className="text-lg font-semibold text-accent">×{m.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="levels-heading">
        <h2 id="levels-heading" className="text-xl font-semibold tracking-tight">
          Levels
        </h2>
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-(--radius-card) border border-border">
          {LEVELS.map((l) => (
            <li key={l.level} className="flex items-center gap-4 bg-card px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">
                {l.level}
              </span>
              <span className="flex-1 text-sm font-medium">{l.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatNumber(l.minPoints)}+ points
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Level 5 unlocks the Local Guide role — the ability to suggest new
          destinations and submit corrections, which enter a review queue.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="verify-heading">
        <h2 id="verify-heading" className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ShieldCheck className="size-5 text-success" aria-hidden />
          How a check-in is verified
        </h2>
        <p className="prose-trail mt-2 text-muted-foreground">
          A leaderboard that can be faked is worth nothing, so every check-in
          goes through the same pipeline before any points are credited.
        </p>
        <ol className="mt-5 space-y-3">
          {[
            {
              icon: <Camera className="size-4" />,
              title: "In-app camera only",
              body: "Gallery uploads cannot be used for a scoring check-in. Non-scoring gallery contributions are allowed and flagged as such.",
            },
            {
              icon: <MapPin className="size-4" />,
              title: "Inside the geofence",
              body: "Your GPS must fall within the destination's fence — between 100 m and 5 km depending on the site. GPS accuracy is allowed for rather than ignored.",
            },
            {
              icon: <ShieldCheck className="size-4" />,
              title: "Timestamp, duplicate and spoof checks",
              body: "Server time is authoritative. Perceptual hashing catches re-uploads and screenshots. Mock-location, rooted devices and impossible travel speeds are flagged.",
            },
            {
              icon: <ShieldCheck className="size-4" />,
              title: "Human review where it matters",
              body: "Anything the pipeline flags goes to a moderator with every signal laid out, plus a random audit of auto-approved submissions. Rejected check-ins can be appealed once.",
            },
          ].map((s) => (
            <li key={s.title} className="flex gap-3.5 rounded-xl border border-border bg-card p-4">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                {s.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold">{s.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {s.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          There are <strong className="text-foreground">no monetary rewards</strong>{" "}
          in v1. That removes the entire fraud incentive while the verification
          pipeline is still being proven. Partner offers and redeemable rewards
          arrive in Phase 2, once the measured fraud rate is under 2%.
        </p>
      </section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-8">
        <Link
          href="/explore?tier=4&sort=points"
          className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Find the 150-point places
        </Link>
        <Link
          href="/leaderboards"
          className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium"
        >
          See the leaderboard
        </Link>
      </div>
    </div>
  );
}
