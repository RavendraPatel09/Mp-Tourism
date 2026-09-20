import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Trophy, Users } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { formatCompact, formatDate, relativeTime } from "@/lib/format";
import { challenges } from "@/mocks/seed/challenges";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DestinationCard } from "@/components/public/destination-card";
import { Photo } from "@/components/public/photo";

export const revalidate = 1800;

export function generateStaticParams() {
  return challenges.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await serverApi.challenge(slug);
  if (!c) return { title: "Challenge not found" };
  return {
    title: c.title,
    description: c.description.slice(0, 160),
    alternates: { canonical: `/challenges/${c.slug}` },
  };
}

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const challenge = await serverApi.challenge(slug);
  if (!challenge) notFound();

  const destinations = (
    await Promise.all(challenge.destinationSlugs.map((s) => serverApi.destination(s)))
  ).filter((d): d is NonNullable<typeof d> => Boolean(d));

  // Demo progress for the signed-in explorer while check-ins are Member B's.
  const completed = destinations.slice(0, Math.min(2, destinations.length));
  const progressPct = Math.min(
    100,
    Math.round((completed.length / challenge.requiredCount) * 100),
  );

  const basePoints = destinations.reduce((s, d) => s + d.basePoints, 0);
  const maxWithMultiplier = Math.round(basePoints * challenge.multiplier) + challenge.rewardPoints;

  return (
    <div>
      <section className="border-b border-border">
        <div className="relative h-56 bg-muted sm:h-72">
          <Photo media={challenge.heroImage} tier={4} alt={challenge.title} priority credit scrim sizes="100vw" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/challenges" className="hover:underline">
              Challenges
            </Link>
            <span aria-hidden> / </span>
            <span className="text-foreground">{challenge.title}</span>
          </nav>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={challenge.status === "active" ? "success" : challenge.status === "upcoming" ? "primary" : "muted"}>
              {challenge.status === "active"
                ? `Running · ends ${relativeTime(challenge.endsAt)}`
                : challenge.status === "upcoming"
                  ? `Starts ${formatDate(challenge.startsAt)}`
                  : `Ended ${formatDate(challenge.endsAt)}`}
            </Badge>
            {challenge.multiplier > 1 ? (
              <Badge variant="warning">{challenge.multiplier}× points multiplier</Badge>
            ) : null}
            {challenge.scope === "state" ? (
              <Badge variant="outline">{challenge.stateCode} only</Badge>
            ) : (
              <Badge variant="outline">National</Badge>
            )}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {challenge.title}
          </h1>
          <p className="prose-trail mt-3 text-muted-foreground">{challenge.description}</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div>
            <section aria-labelledby="progress-heading">
              <h2 id="progress-heading" className="text-xl font-semibold tracking-tight">
                Your progress
              </h2>
              <div className="mt-4 rounded-(--radius-card) border border-border bg-card p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm">
                    <span className="text-2xl font-semibold tabular-nums">
                      {completed.length}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      of {challenge.requiredCount} needed
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {challenge.requiredCount - completed.length > 0
                      ? `${challenge.requiredCount - completed.length} more to finish`
                      : "Complete"}
                  </p>
                </div>
                <Progress
                  value={progressPct}
                  className="mt-3"
                  label={`${progressPct}% complete`}
                />
                <ul className="mt-4 space-y-2">
                  {destinations.map((d) => {
                    const done = completed.some((c) => c.slug === d.slug);
                    return (
                      <li key={d.slug} className="flex items-center gap-2.5 text-sm">
                        <CheckCircle2
                          aria-hidden
                          className={`size-4 shrink-0 ${done ? "text-success" : "text-border"}`}
                        />
                        <Link
                          href={`/destinations/${d.slug}`}
                          className={done ? "text-muted-foreground line-through" : "hover:underline"}
                        >
                          {d.name}
                        </Link>
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {challenge.multiplier > 1
                            ? `${d.basePoints} × ${challenge.multiplier} = ${Math.round(d.basePoints * challenge.multiplier)}`
                            : `${d.basePoints}`}{" "}
                          pts
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">
                  Check-ins are made in the mobile app — you have to be inside
                  the geofence with the in-app camera. This page tracks progress.
                </p>
              </div>
            </section>

            <section className="mt-12" aria-labelledby="destinations-heading">
              <h2 id="destinations-heading" className="text-xl font-semibold tracking-tight">
                Destinations in this challenge
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {destinations.map((d) => (
                  <DestinationCard key={d.slug} destination={d} />
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-(--radius-card) border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Maximum on offer</h2>
              <p className="mt-2 text-4xl font-semibold tabular-nums text-accent">
                {formatCompact(maxWithMultiplier)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                points, if you complete every destination
              </p>
              <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Base check-in points</dt>
                  <dd className="font-medium tabular-nums">{basePoints}</dd>
                </div>
                {challenge.multiplier > 1 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Multiplier</dt>
                    <dd className="font-medium tabular-nums">×{challenge.multiplier}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Completion bonus</dt>
                  <dd className="font-medium tabular-nums">+{challenge.rewardPoints}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-(--radius-card) border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Who is doing it</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <Users className="size-4 text-muted-foreground" aria-hidden />
                  <dt className="text-muted-foreground">Taking part</dt>
                  <dd className="ml-auto font-semibold tabular-nums">
                    {formatCompact(challenge.participantCount)}
                  </dd>
                </div>
                <div className="flex items-center gap-2.5">
                  <Trophy className="size-4 text-muted-foreground" aria-hidden />
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd className="ml-auto font-semibold tabular-nums">
                    {formatCompact(challenge.completedCount)}
                  </dd>
                </div>
                <div className="flex items-center gap-2.5">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                  <dt className="text-muted-foreground">Window</dt>
                  <dd className="ml-auto text-right text-xs font-medium">
                    {formatDate(challenge.startsAt)} – {formatDate(challenge.endsAt)}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
