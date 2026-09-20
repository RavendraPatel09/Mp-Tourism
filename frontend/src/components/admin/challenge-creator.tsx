"use client";

import * as React from "react";
import { Check, Eye, Sparkles, Trophy, Users } from "lucide-react";
import { formatCompact, formatDate } from "@/lib/format";
import type { Challenge, DestinationSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Challenge creator (PRD F24).
 *
 * The live preview on the right is the point — a state admin setting a 2×
 * multiplier should see the traveller-facing card and the resulting maximum
 * point value before publishing, not after.
 */
export function ChallengeCreator({
  destinations,
  existing,
}: {
  destinations: DestinationSummary[];
  existing: Challenge[];
}) {
  const [title, setTitle] = React.useState("Off the Map — October");
  const [description, setDescription] = React.useState(
    "Check in at three Tier-4 destinations before the month is out.",
  );
  const [type, setType] = React.useState<Challenge["type"]>("discovery");
  const [scope, setScope] = React.useState<Challenge["scope"]>("state");
  const [multiplier, setMultiplier] = React.useState(1.5);
  const [rewardPoints, setRewardPoints] = React.useState(600);
  const [requiredCount, setRequiredCount] = React.useState(3);
  const [startsAt, setStartsAt] = React.useState("2026-10-01");
  const [endsAt, setEndsAt] = React.useState("2026-10-31");
  const [selected, setSelected] = React.useState<string[]>(
    destinations.filter((d) => d.tier === 4).slice(0, 6).map((d) => d.slug),
  );
  const [published, setPublished] = React.useState(false);

  const chosen = destinations.filter((d) => selected.includes(d.slug));
  const basePoints = chosen.reduce((s, d) => s + d.basePoints, 0);
  const maxPoints = Math.round(basePoints * multiplier) + rewardPoints;
  const avgTier = chosen.length
    ? (chosen.reduce((s, d) => s + d.tier, 0) / chosen.length).toFixed(1)
    : "—";

  function toggle(slug: string) {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <section className="rounded-(--radius-card) border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Details</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="ch-title">Title</Label>
              <Input
                id="ch-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ch-desc">Description</Label>
              <Textarea
                id="ch-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ch-type">Type</Label>
                <Select
                  id="ch-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as Challenge["type"])}
                  className="mt-1.5"
                >
                  <option value="discovery">Discovery</option>
                  <option value="circuit">Circuit</option>
                  <option value="seasonal">Seasonal / event</option>
                  <option value="government">Government campaign</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="ch-scope">Scope</Label>
                <Select
                  id="ch-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as Challenge["scope"])}
                  className="mt-1.5"
                >
                  <option value="state">Madhya Pradesh only</option>
                  <option value="national">National</option>
                </Select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-(--radius-card) border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Criteria &amp; rewards</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="ch-start">Starts</Label>
              <Input
                id="ch-start"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ch-end">Ends</Label>
              <Input
                id="ch-end"
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ch-required">Required check-ins</Label>
              <Input
                id="ch-required"
                type="number"
                min={1}
                max={Math.max(1, selected.length)}
                value={requiredCount}
                onChange={(e) => setRequiredCount(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ch-bonus">Completion bonus</Label>
              <Input
                id="ch-bonus"
                type="number"
                step={50}
                value={rewardPoints}
                onChange={(e) => setRewardPoints(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="ch-mult">Points multiplier</Label>
              <span className="text-sm font-semibold">×{multiplier}</span>
            </div>
            <input
              id="ch-mult"
              type="range"
              min={1}
              max={3}
              step={0.5}
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Applies to every check-in at a listed destination for the duration.
              Anything above ×2 needs super-admin approval.
            </p>
          </div>
        </section>

        <section className="rounded-(--radius-card) border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Destinations ({selected.length} selected)
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSelected(destinations.filter((d) => d.tier === 4).map((d) => d.slug))
                }
              >
                All Tier 4
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSelected(destinations.filter((d) => d.tier >= 3).map((d) => d.slug))
                }
              >
                All Tier 3+4
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          </div>

          <ul className="mt-4 grid max-h-96 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {destinations.map((d) => {
              const on = selected.includes(d.slug);
              return (
                <li key={d.slug}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(d.slug)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                      on ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {on ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {d.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {d.district}
                      </span>
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: `color-mix(in srgb, var(--color-tier-${d.tier}) 14%, transparent)`,
                        color: `var(--color-tier-${d.tier})`,
                      }}
                    >
                      {d.basePoints}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* ------------------------------------------------------- preview */}
      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Eye className="size-4" aria-hidden />
          Traveller sees
        </h2>

        <article className="overflow-hidden rounded-(--radius-card) border border-border bg-card">
          <div
            className="relative aspect-[21/9]"
            style={{
              background:
                "linear-gradient(135deg, var(--color-tier-4), color-mix(in srgb, var(--color-tier-4) 40%, #000))",
            }}
          >
            <div className="absolute top-3 left-3 flex gap-1.5">
              <Badge variant="success">Running now</Badge>
              <Badge variant="outline" className="bg-card/90 capitalize backdrop-blur">
                {type}
              </Badge>
            </div>
            {multiplier > 1 ? (
              <span className="absolute top-3 right-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                {multiplier}× points
              </span>
            ) : null}
          </div>
          <div className="p-4">
            <h3 className="font-semibold">{title || "Untitled challenge"}</h3>
            <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">
              {description || "No description yet."}
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <div className="inline-flex items-center gap-1">
                <Trophy className="size-3" aria-hidden />
                <dd>{rewardPoints} pts bonus</dd>
              </div>
              <div className="inline-flex items-center gap-1">
                <Sparkles className="size-3" aria-hidden />
                <dd>
                  {requiredCount} of {selected.length}
                </dd>
              </div>
              <div className="inline-flex items-center gap-1">
                <Users className="size-3" aria-hidden />
                <dd>0 taking part</dd>
              </div>
            </dl>
          </div>
        </article>

        <div className="rounded-(--radius-card) border border-border bg-card p-4">
          <h3 className="text-xs font-semibold tracking-wider uppercase">
            Impact estimate
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Destinations</dt>
              <dd className="font-medium tabular-nums">{selected.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Average tier</dt>
              <dd className="font-medium tabular-nums">{avgTier}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Base points</dt>
              <dd className="font-medium tabular-nums">{basePoints}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-2">
              <dt className="font-medium">Max per explorer</dt>
              <dd className="font-semibold tabular-nums text-accent">
                {formatCompact(maxPoints)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Window</dt>
              <dd className="text-right text-xs">
                {formatDate(startsAt)} – {formatDate(endsAt)}
              </dd>
            </div>
          </dl>

          {Number(avgTier) < 3 && selected.length > 0 ? (
            <p className="mt-3 rounded-lg bg-warning/12 p-2.5 text-xs text-warning">
              Average tier is under 3. A challenge weighted toward marquee sites
              pushes footfall the wrong way — consider swapping in Tier 3 and 4
              destinations.
            </p>
          ) : null}
        </div>

        <Button
          className="w-full"
          disabled={selected.length === 0 || published}
          onClick={() => setPublished(true)}
        >
          {published ? "Published" : "Publish challenge"}
        </Button>
        {published ? (
          <p className="rounded-lg bg-success/12 p-3 text-xs text-success">
            Published and written to the audit log. A push notification goes to
            explorers in or near {scope === "state" ? "Madhya Pradesh" : "India"}.
          </p>
        ) : null}

        <div className="rounded-(--radius-card) border border-border bg-card p-4">
          <h3 className="text-xs font-semibold tracking-wider uppercase">
            Already running
          </h3>
          <ul className="mt-3 space-y-2">
            {existing
              .filter((c) => c.status === "active")
              .map((c) => (
                <li key={c.slug} className="text-xs">
                  <span className="block font-medium">{c.title}</span>
                  <span className="text-muted-foreground">
                    ×{c.multiplier} · ends {formatDate(c.endsAt)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
