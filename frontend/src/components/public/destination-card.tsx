import Link from "next/link";
import { Clock, MapPin, Star } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import { DIFFICULTY_LABEL, formatDuration } from "@/lib/format";
import type { DestinationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CrowdIndicator } from "./crowd-indicator";
import { Photo } from "./photo";
import { PointsPill, TierBadge } from "./tier-badge";

export function DestinationCard({
  destination: d,
  className,
  priority,
}: {
  destination: DestinationSummary;
  className?: string;
  priority?: boolean;
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-(--radius-card) border border-border bg-card transition-shadow hover:shadow-lg",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        <Photo
          media={d.heroImage}
          tier={d.tier}
          alt={d.name}
          priority={priority}
          credit
          scrim
          className="transition-transform duration-500 ease-out group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <TierBadge tier={d.tier} showLabel={false} className="bg-card/95 backdrop-blur" />
        </div>
        <div className="absolute top-3 right-3">
          <PointsPill tier={d.tier} points={d.basePoints} size="sm" className="bg-card/95 backdrop-blur" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base leading-snug font-semibold">
            <Link
              href={`/destinations/${d.slug}`}
              className="after:absolute after:inset-0 hover:underline"
            >
              {d.name}
            </Link>
          </h3>
        </div>

        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin aria-hidden className="size-3" />
          {d.district}, {d.stateName}
          {d.distanceKm !== undefined ? (
            <span className="ml-1 font-medium text-foreground">
              · {formatDistance(d.distanceKm)} away
            </span>
          ) : null}
        </p>

        <p className="mt-2.5 line-clamp-3 flex-1 text-sm text-muted-foreground">
          {d.shortDescription}
        </p>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden className="size-3" />
            {formatDuration(d.recommendedDurationMin)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star aria-hidden className="size-3 fill-current" />
            {d.rating.toFixed(1)}
            <span className="opacity-70">({d.reviewCount})</span>
          </span>
          <span>{DIFFICULTY_LABEL[d.difficulty]}</span>
          <CrowdIndicator level={d.crowdLevel} showLabel={false} className="ml-auto" />
        </div>
      </div>
    </article>
  );
}

export function DestinationCardCompact({
  destination: d,
}: {
  destination: DestinationSummary;
}) {
  return (
    <article className="group relative flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Photo media={d.heroImage} tier={d.tier} alt={d.name} sizes="80px" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="truncate text-sm font-semibold">
            <Link href={`/destinations/${d.slug}`} className="after:absolute after:inset-0">
              {d.name}
            </Link>
          </h4>
          <PointsPill tier={d.tier} points={d.basePoints} size="sm" />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {d.district}
          {d.distanceKm !== undefined ? ` · ${formatDistance(d.distanceKm)}` : ""}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {d.shortDescription}
        </p>
      </div>
    </article>
  );
}
