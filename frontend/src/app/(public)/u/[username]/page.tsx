import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as Icons from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { formatDate, formatNumber, initials } from "@/lib/format";
import { levelForPoints } from "@/lib/points";
import { leaderboard } from "@/mocks/seed/users";
import { Progress } from "@/components/ui/progress";
import { IndiaMap } from "@/components/public/india-map";
import { PointsPill, TierBadge } from "@/components/public/tier-badge";
import type { Badge as BadgeType } from "@/lib/types";

export const revalidate = 600;

export function generateStaticParams() {
  return leaderboard.slice(0, 10).map((e) => ({ username: e.username }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const p = await serverApi.profile(username);
  if (!p) return { title: "Explorer not found" };
  return {
    title: `${p.displayName} (@${p.username})`,
    description: `${p.levelName}, ${formatNumber(p.totalPoints)} points, ${p.stats.checkIns} verified check-ins — ${Math.round((p.stats.tier34CheckIns / p.stats.checkIns) * 100)}% of them at Tier 3 and 4 destinations.`,
    alternates: { canonical: `/u/${p.username}` },
  };
}

function BadgeTile({ badge }: { badge: BadgeType }) {
  const Icon = (Icons[badge.icon as keyof typeof Icons] ??
    Icons.Award) as React.ComponentType<{ className?: string }>;
  return (
    <li className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3.5 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-accent/12 text-accent">
        <Icon className="size-5" />
      </span>
      <span className="text-xs leading-tight font-semibold">{badge.name}</span>
      <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
        {badge.description}
      </span>
    </li>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const p = await serverApi.profile(username);
  if (!p) notFound();

  const lvl = levelForPoints(p.totalPoints);
  const tier34Pct = Math.round((p.stats.tier34CheckIns / p.stats.checkIns) * 100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* ------------------------------------------------------------ header */}
      <header className="flex flex-wrap items-start gap-6">
        <span
          aria-hidden
          className="grid size-20 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white"
          style={{ background: p.avatarColor }}
        >
          {initials(p.displayName)}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{p.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            @{p.username} · {p.homeState} · joined {formatDate(p.joinedAt, { month: "long" })}
          </p>

          <div className="mt-4 max-w-sm">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">
                Level {p.level} · {p.levelName}
              </span>
              {lvl.nextName ? (
                <span className="text-xs text-muted-foreground">
                  {formatNumber(lvl.pointsToNext)} to {lvl.nextName}
                </span>
              ) : (
                <span className="text-xs text-accent">Max level</span>
              )}
            </div>
            <Progress
              value={lvl.progressPct}
              className="mt-2"
              barClassName="bg-accent"
              label={`Level ${p.level} progress`}
            />
          </div>
        </div>

        <div className="text-right">
          <p className="text-4xl font-semibold tabular-nums text-accent">
            {formatNumber(p.totalPoints)}
          </p>
          <p className="text-xs text-muted-foreground">total points</p>
        </div>
      </header>

      {/* ------------------------------------------------------------- stats */}
      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-(--radius-card) border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Check-ins", value: formatNumber(p.stats.checkIns) },
          { label: "Destinations", value: formatNumber(p.stats.destinations) },
          { label: "Tier 3+4", value: `${tier34Pct}%`, accent: true },
          { label: "Photos accepted", value: formatNumber(p.stats.photosAccepted) },
          { label: "Reviews", value: formatNumber(p.stats.reviews) },
          { label: "Pioneer firsts", value: formatNumber(p.stats.pioneerCount) },
        ].map((s) => (
          <div key={s.label} className="bg-card p-4">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd
              className={`mt-1 text-xl font-semibold tabular-nums ${s.accent ? "text-accent" : ""}`}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-12">
          {/* --------------------------------------------------- badge wall */}
          <section aria-labelledby="badges-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="badges-heading" className="text-xl font-semibold tracking-tight">
                Badge wall
              </h2>
              <p className="text-sm text-muted-foreground">
                {p.badges.length} earned
              </p>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {p.badges.map((b) => (
                <BadgeTile key={b.id} badge={b} />
              ))}
            </ul>
          </section>

          {/* --------------------------------------------------- check-ins */}
          <section aria-labelledby="checkins-heading">
            <h2 id="checkins-heading" className="text-xl font-semibold tracking-tight">
              Recent check-ins
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Destinations only — never raw coordinates or exact timestamps.
              Precise GPS is used at the moment of check-in and not kept.
            </p>
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-(--radius-card) border border-border">
              {p.recentCheckIns.map((c) => (
                <li key={c.id} className="flex items-center gap-3 bg-card p-4">
                  <TierBadge tier={c.tier} showLabel={false} />
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/destinations/${c.destinationSlug}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {c.destinationName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(c.capturedAt, { month: "long" })}
                    </span>
                  </span>
                  <PointsPill tier={c.tier} points={c.pointsAwarded} size="sm" />
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ------------------------------------------------------- sidebar */}
        <aside className="space-y-6">
          <div className="rounded-(--radius-card) border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">States visited</h2>
            <IndiaMap visited={p.statesVisited} className="mt-4" />
          </div>

          <div className="rounded-(--radius-card) border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Long-tail share</h2>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-accent">
              {tier34Pct}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              of check-ins at Tier 3 and Tier 4 destinations
            </p>
            <Progress value={tier34Pct} className="mt-3" barClassName="bg-accent" />
            <p className="mt-3 text-xs text-muted-foreground">
              The platform target is 35% across all explorers. Anything above
              that is moving footfall where it is needed.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
