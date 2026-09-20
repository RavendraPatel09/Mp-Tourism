import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Sparkles, Trophy, Users } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { formatCompact, formatDate, relativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/public/photo";
import type { Challenge } from "@/lib/types";

export const metadata: Metadata = {
  title: "Challenges",
  description:
    "Time-boxed discovery challenges, circuit trails and state tourism board campaigns. Multipliers stack on top of the base points for every check-in.",
  alternates: { canonical: "/challenges" },
};

export const revalidate = 1800;

const TYPE_LABEL: Record<Challenge["type"], string> = {
  circuit: "Circuit",
  discovery: "Discovery",
  seasonal: "Seasonal",
  government: "Govt campaign",
};

function ChallengeCard({ c }: { c: Challenge }) {
  return (
    <article className="group relative overflow-hidden rounded-(--radius-card) border border-border bg-card">
      <div className="relative aspect-[21/9] bg-muted">
        <Photo media={c.heroImage} tier={4} alt={c.title} credit scrim sizes="(max-width: 1024px) 100vw, 50vw" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge variant={c.status === "active" ? "success" : c.status === "upcoming" ? "primary" : "muted"}>
            {c.status === "active" ? "Running now" : c.status === "upcoming" ? "Upcoming" : "Ended"}
          </Badge>
          <Badge variant="outline" className="bg-card/90 backdrop-blur">
            {TYPE_LABEL[c.type]}
          </Badge>
        </div>
        {c.multiplier > 1 ? (
          <span className="absolute top-3 right-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
            {c.multiplier}× points
          </span>
        ) : null}
      </div>

      <div className="p-5">
        <h2 className="text-lg font-semibold">
          <Link
            href={`/challenges/${c.slug}`}
            className="after:absolute after:inset-0 hover:underline"
          >
            {c.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
          {c.description}
        </p>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Trophy className="size-3.5" aria-hidden />
            <dt className="sr-only">Completion bonus</dt>
            <dd>{c.rewardPoints} pts bonus</dd>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5" aria-hidden />
            <dt className="sr-only">Required</dt>
            <dd>
              {c.requiredCount} of {c.destinationSlugs.length} destinations
            </dd>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            <dt className="sr-only">Participants</dt>
            <dd>{formatCompact(c.participantCount)} taking part</dd>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" aria-hidden />
            <dt className="sr-only">Window</dt>
            <dd>
              {c.status === "active"
                ? `Ends ${relativeTime(c.endsAt)}`
                : c.status === "upcoming"
                  ? `Starts ${formatDate(c.startsAt)}`
                  : `Ended ${formatDate(c.endsAt)}`}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export default async function ChallengesPage() {
  const challenges = await serverApi.challenges();
  const groups = [
    { key: "active", label: "Running now", items: challenges.filter((c) => c.status === "active") },
    { key: "upcoming", label: "Coming up", items: challenges.filter((c) => c.status === "upcoming") },
    { key: "ended", label: "Finished", items: challenges.filter((c) => c.status === "ended") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Challenges</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Time-boxed, and mostly pointed at the long tail. State tourism boards
        run campaigns here too — when a board wants footfall in a district,
        a multiplier is the lever.
      </p>

      {groups.map((g) => (
        <section key={g.key} className="mt-12" aria-labelledby={`group-${g.key}`}>
          <h2
            id={`group-${g.key}`}
            className="text-sm font-semibold tracking-wider uppercase"
          >
            {g.label}
          </h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {g.items.map((c) => (
              <ChallengeCard key={c.slug} c={c} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
