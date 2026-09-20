"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  ExternalLink,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { DIFFICULTY_LABEL, SEASON_LABEL, formatDuration } from "@/lib/format";
import { TIER_META, TIER_POINTS } from "@/lib/points";
import type { Destination, Difficulty, Season, Tier } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { GeofenceEditor } from "./geofence-editor";
import { cn } from "@/lib/utils";

type Tab = "basics" | "content" | "itinerary" | "visitor" | "geofence" | "media" | "publish";

const DIFFICULTIES: Difficulty[] = ["easy", "moderate", "challenging", "strenuous"];
const SEASONS: Season[] = ["winter", "summer", "monsoon", "post_monsoon", "year_round"];
const TIERS: Tier[] = [1, 2, 3, 4];

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-(--radius-card) border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/**
 * Destination CMS (PRD F22).
 *
 * Tabbed rather than one long form, because the content sprint has different
 * people filling different tabs — whoever researched the place writes Content
 * and Itinerary; whoever went there fills Visitor info and Geofence.
 *
 * Edits are local until Save, which PATCHes the mock API. Replacing that with
 * Member B's endpoint is a one-line change in lib/api/client.ts.
 */
export function DestinationEditor({
  destination,
  completenessScore,
  onSave,
}: {
  destination: Destination;
  completenessScore: number;
  onSave?: (patch: Partial<Destination>) => Promise<void> | void;
}) {
  const [tab, setTab] = React.useState<Tab>("basics");
  const [draft, setDraft] = React.useState(destination);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(destination);

  function set<K extends keyof Destination>(key: K, value: Destination[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    await onSave?.(draft);
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString("en-IN"));
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: "basics", label: "Basics" },
    { value: "content", label: "Content" },
    { value: "itinerary", label: "Itinerary" },
    { value: "visitor", label: "Visitor info" },
    { value: "geofence", label: "Geofence" },
    { value: "media", label: "Media" },
    { value: "publish", label: "Publish" },
  ];

  return (
    <div>
      {/* ------------------------------------------------------- sticky bar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Editor sections" />

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <Progress
              value={completenessScore}
              className="h-1.5 w-24"
              barClassName={completenessScore >= 90 ? "bg-success" : "bg-warning"}
              label="Content completeness"
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {completenessScore}% complete
            </span>
          </div>

          {savedAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <Check className="size-3.5" aria-hidden />
              Saved {savedAt}
            </span>
          ) : null}

          <Button size="sm" onClick={save} disabled={!dirty || saving} className="gap-1.5">
            <Save className="size-3.5" aria-hidden />
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* ------------------------------------------------------- basics */}
        {tab === "basics" ? (
          <>
            <Section title="Identity">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Slug" hint="Changing this breaks existing links and SEO.">
                  <Input value={draft.slug} readOnly className="bg-muted" />
                </Field>
                <Field label="District">
                  <Input value={draft.district} onChange={(e) => set("district", e.target.value)} />
                </Field>
                <Field label="State">
                  <Input value={draft.stateName} readOnly className="bg-muted" />
                </Field>
              </div>

              <Field
                label="Short description"
                hint="One sentence. Appears on cards, search results and the meta description."
              >
                <Textarea
                  rows={2}
                  value={draft.shortDescription}
                  onChange={(e) => set("shortDescription", e.target.value)}
                />
              </Field>
            </Section>

            <Section title="Tier & points">
              <div
                className="rounded-lg border border-warning/30 bg-warning/8 p-3 text-xs text-warning"
                role="note"
              >
                Tier is platform-controlled and recomputed quarterly from
                footfall, review volume and board input. State admins can
                propose a change but cannot set it — that is deliberate, to stop
                tier inflation on a board&apos;s own destinations.
              </div>

              <div className="flex flex-wrap gap-2">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled
                    aria-pressed={draft.tier === t}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed",
                      draft.tier === t ? "border-primary bg-primary-soft" : "border-border opacity-50",
                    )}
                  >
                    <span className="block text-xs font-semibold">
                      {TIER_META[t].label}
                    </span>
                    <span
                      className="block text-lg font-semibold tabular-nums"
                      style={{ color: `var(--color-tier-${t})` }}
                    >
                      {TIER_POINTS[t]} pts
                    </span>
                  </button>
                ))}
              </div>

              <Field
                label="Points rationale"
                hint="Shown to explorers on the listing. Explain why this is worth what it is worth."
              >
                <Textarea
                  rows={3}
                  value={draft.pointsRationale}
                  onChange={(e) => set("pointsRationale", e.target.value)}
                />
              </Field>
            </Section>

            <Section title="Trip planning attributes">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Minimum visit (min)">
                  <Input
                    type="number"
                    value={draft.minDurationMin}
                    onChange={(e) => set("minDurationMin", Number(e.target.value))}
                  />
                </Field>
                <Field label="Recommended (min)">
                  <Input
                    type="number"
                    value={draft.recommendedDurationMin}
                    onChange={(e) => set("recommendedDurationMin", Number(e.target.value))}
                  />
                </Field>
                <Field label="Difficulty">
                  <Select
                    value={draft.difficulty}
                    onChange={(e) => set("difficulty", e.target.value as Difficulty)}
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_LABEL[d]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Typical spend (₹)">
                  <Input
                    type="number"
                    value={draft.avgBudgetInr}
                    onChange={(e) => set("avgBudgetInr", Number(e.target.value))}
                  />
                </Field>
              </div>

              <Field label="Best seasons">
                <div className="flex flex-wrap gap-2">
                  {SEASONS.map((s) => {
                    const on = draft.bestSeasons.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          set(
                            "bestSeasons",
                            on
                              ? draft.bestSeasons.filter((x) => x !== s)
                              : [...draft.bestSeasons, s],
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {SEASON_LABEL[s].split(" (")[0]}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Crowd level" hint="Drives the carrying-capacity indicator.">
                  <Select
                    value={draft.crowdLevel}
                    onChange={(e) =>
                      set("crowdLevel", e.target.value as Destination["crowdLevel"])
                    }
                  >
                    <option value="low">Rarely crowded</option>
                    <option value="moderate">Moderate crowds</option>
                    <option value="high">Gets crowded</option>
                    <option value="at_capacity">At carrying capacity</option>
                  </Select>
                </Field>

                <Field label="Flags">
                  <div className="space-y-2 pt-1.5">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.isEcoSensitive}
                        onChange={(e) => set("isEcoSensitive", e.target.checked)}
                        className="size-4 accent-[var(--primary)]"
                      />
                      Eco-sensitive
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.accessibility.wheelchair}
                        onChange={(e) =>
                          set("accessibility", {
                            ...draft.accessibility,
                            wheelchair: e.target.checked,
                          })
                        }
                        className="size-4 accent-[var(--primary)]"
                      />
                      Wheelchair accessible
                    </label>
                  </div>
                </Field>
              </div>
            </Section>
          </>
        ) : null}

        {/* ------------------------------------------------------ content */}
        {tab === "content" ? (
          <>
            <Section title="Narrative">
              <Field label="Why go" hint="The argument for the detour. Two or three sentences.">
                <Textarea rows={4} value={draft.whyGo} onChange={(e) => set("whyGo", e.target.value)} />
              </Field>
              <Field
                label="Story"
                hint="Historical and cultural context. This is what makes the listing better than a government PDF."
              >
                <Textarea rows={10} value={draft.story} onChange={(e) => set("story", e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.story.length} characters
                </p>
              </Field>
            </Section>

            <Section title={`Things to do (${draft.thingsToDo.length})`}>
              <p className="text-xs text-muted-foreground">
                A concrete checklist, not prose. &ldquo;Catch the 6 pm
                aarti&rdquo;, not &ldquo;the temple has evening rituals&rdquo;.
              </p>
              <ul className="space-y-2">
                {draft.thingsToDo.map((t, i) => (
                  <li key={t.id} className="flex gap-3 rounded-xl border border-border p-3">
                    <span className="mt-2 cursor-grab text-muted-foreground" aria-hidden>
                      <GripVertical className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        value={t.title}
                        aria-label={`Thing to do ${i + 1} title`}
                        onChange={(e) => {
                          const next = [...draft.thingsToDo];
                          next[i] = { ...t, title: e.target.value };
                          set("thingsToDo", next);
                        }}
                      />
                      <Textarea
                        rows={2}
                        value={t.description ?? ""}
                        aria-label={`Thing to do ${i + 1} description`}
                        onChange={(e) => {
                          const next = [...draft.thingsToDo];
                          next[i] = { ...t, description: e.target.value };
                          set("thingsToDo", next);
                        }}
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <Input
                        type="number"
                        value={t.durationMin}
                        aria-label={`Thing to do ${i + 1} duration in minutes`}
                        onChange={(e) => {
                          const next = [...draft.thingsToDo];
                          next[i] = { ...t, durationMin: Number(e.target.value) };
                          set("thingsToDo", next);
                        }}
                      />
                      <p className="mt-1 text-center text-[11px] text-muted-foreground">
                        minutes
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove thing to do ${i + 1}`}
                      onClick={() =>
                        set(
                          "thingsToDo",
                          draft.thingsToDo.filter((x) => x.id !== t.id),
                        )
                      }
                      className="h-9 shrink-0 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  set("thingsToDo", [
                    ...draft.thingsToDo,
                    {
                      id: `ttd-new-${Date.now()}`,
                      title: "",
                      description: "",
                      durationMin: 30,
                      orderIndex: draft.thingsToDo.length,
                    },
                  ])
                }
              >
                <Plus className="size-3.5" aria-hidden />
                Add a thing to do
              </Button>
            </Section>
          </>
        ) : null}

        {/* ---------------------------------------------------- itinerary */}
        {tab === "itinerary" ? (
          <Section title={draft.itinerary.title}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Itinerary title" className="sm:col-span-2">
                <Input
                  value={draft.itinerary.title}
                  onChange={(e) =>
                    set("itinerary", { ...draft.itinerary, title: e.target.value })
                  }
                />
              </Field>
              <Field label="Total planned">
                <Input
                  readOnly
                  className="bg-muted"
                  value={formatDuration(draft.itinerary.totalDurationMin)}
                />
              </Field>
            </div>

            <ul className="space-y-2">
              {draft.itinerary.stops.map((s, i) => (
                <li key={s.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[4rem_5rem_1fr_6rem_2.5rem]">
                  <Input
                    type="number"
                    min={1}
                    value={s.day}
                    aria-label={`Stop ${i + 1} day`}
                    onChange={(e) => {
                      const stops = [...draft.itinerary.stops];
                      stops[i] = { ...s, day: Number(e.target.value) };
                      set("itinerary", { ...draft.itinerary, stops });
                    }}
                  />
                  <Input
                    value={s.startTime}
                    aria-label={`Stop ${i + 1} start time`}
                    onChange={(e) => {
                      const stops = [...draft.itinerary.stops];
                      stops[i] = { ...s, startTime: e.target.value };
                      set("itinerary", { ...draft.itinerary, stops });
                    }}
                  />
                  <div className="space-y-2">
                    <Input
                      value={s.activity}
                      aria-label={`Stop ${i + 1} activity`}
                      onChange={(e) => {
                        const stops = [...draft.itinerary.stops];
                        stops[i] = { ...s, activity: e.target.value };
                        set("itinerary", { ...draft.itinerary, stops });
                      }}
                    />
                    <Input
                      value={s.travelNotes ?? ""}
                      placeholder="Travel note (optional) — e.g. 13 km via Vidisha"
                      aria-label={`Stop ${i + 1} travel notes`}
                      onChange={(e) => {
                        const stops = [...draft.itinerary.stops];
                        stops[i] = { ...s, travelNotes: e.target.value };
                        set("itinerary", { ...draft.itinerary, stops });
                      }}
                    />
                  </div>
                  <Input
                    type="number"
                    value={s.durationMin}
                    aria-label={`Stop ${i + 1} duration`}
                    onChange={(e) => {
                      const stops = [...draft.itinerary.stops];
                      stops[i] = { ...s, durationMin: Number(e.target.value) };
                      set("itinerary", { ...draft.itinerary, stops });
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove stop ${i + 1}`}
                    onClick={() =>
                      set("itinerary", {
                        ...draft.itinerary,
                        stops: draft.itinerary.stops.filter((x) => x.id !== s.id),
                      })
                    }
                    className="h-10 rounded-md text-muted-foreground hover:bg-muted hover:text-danger"
                  >
                    <Trash2 className="mx-auto size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                set("itinerary", {
                  ...draft.itinerary,
                  stops: [
                    ...draft.itinerary.stops,
                    {
                      id: `stop-new-${Date.now()}`,
                      day: draft.itinerary.dayCount,
                      orderIndex: draft.itinerary.stops.length,
                      startTime: "09:00",
                      activity: "",
                      durationMin: 60,
                    },
                  ],
                })
              }
            >
              <Plus className="size-3.5" aria-hidden />
              Add a stop
            </Button>
          </Section>
        ) : null}

        {/* -------------------------------------------------- visitor info */}
        {tab === "visitor" ? (
          <>
            <Section title="Timings">
              {draft.info.timings.map((t, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={t.label}
                    aria-label={`Timing ${i + 1} label`}
                    onChange={(e) => {
                      const timings = [...draft.info.timings];
                      timings[i] = { ...t, label: e.target.value };
                      set("info", { ...draft.info, timings });
                    }}
                  />
                  <Input
                    value={t.value}
                    aria-label={`Timing ${i + 1} value`}
                    onChange={(e) => {
                      const timings = [...draft.info.timings];
                      timings[i] = { ...t, value: e.target.value };
                      set("info", { ...draft.info, timings });
                    }}
                  />
                </div>
              ))}
              <Field label="Best time of day">
                <Textarea
                  rows={2}
                  value={draft.info.bestTimeOfDay ?? ""}
                  onChange={(e) => set("info", { ...draft.info, bestTimeOfDay: e.target.value })}
                />
              </Field>
            </Section>

            <Section title="Entry fees">
              {draft.info.entryFees.map((f, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                  <Input
                    value={f.label}
                    aria-label={`Fee ${i + 1} label`}
                    onChange={(e) => {
                      const entryFees = [...draft.info.entryFees];
                      entryFees[i] = { ...f, label: e.target.value };
                      set("info", { ...draft.info, entryFees });
                    }}
                  />
                  <Input
                    type="number"
                    value={f.amountInr}
                    aria-label={`Fee ${i + 1} amount`}
                    onChange={(e) => {
                      const entryFees = [...draft.info.entryFees];
                      entryFees[i] = { ...f, amountInr: Number(e.target.value) };
                      set("info", { ...draft.info, entryFees });
                    }}
                  />
                </div>
              ))}
            </Section>

            <Section title="Getting there">
              <Field label="How to reach">
                <Textarea
                  rows={4}
                  value={draft.info.howToReach}
                  onChange={(e) => set("info", { ...draft.info, howToReach: e.target.value })}
                />
              </Field>
              <Field label="Last-mile notes" hint="Road condition, where to park, what the final approach is like.">
                <Textarea
                  rows={3}
                  value={draft.info.lastMileNotes ?? ""}
                  onChange={(e) => set("info", { ...draft.info, lastMileNotes: e.target.value })}
                />
              </Field>
              <Field label="Official URL">
                <Input
                  value={draft.info.officialUrl ?? ""}
                  onChange={(e) => set("info", { ...draft.info, officialUrl: e.target.value })}
                />
              </Field>
            </Section>

            <Section title="Hazards">
              <p className="text-xs text-muted-foreground">
                Genuine safety flags only. These render in red above the
                accordion because someone has usually been hurt.
              </p>
              {draft.info.hazards.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Textarea
                    rows={2}
                    value={h}
                    aria-label={`Hazard ${i + 1}`}
                    onChange={(e) => {
                      const hazards = [...draft.info.hazards];
                      hazards[i] = e.target.value;
                      set("info", { ...draft.info, hazards });
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove hazard ${i + 1}`}
                    onClick={() =>
                      set("info", {
                        ...draft.info,
                        hazards: draft.info.hazards.filter((_, x) => x !== i),
                      })
                    }
                    className="shrink-0 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => set("info", { ...draft.info, hazards: [...draft.info.hazards, ""] })}
              >
                <Plus className="size-3.5" aria-hidden />
                Add a hazard
              </Button>
            </Section>
          </>
        ) : null}

        {/* ------------------------------------------------------ geofence */}
        {tab === "geofence" ? (
          <Section title="Check-in geofence">
            <GeofenceEditor
              name={draft.name}
              tier={draft.tier}
              centre={draft.location}
              radiusM={draft.geofenceRadiusM}
              polygon={draft.geofencePolygon}
              onChange={(next) => {
                setDraft((d) => ({
                  ...d,
                  geofenceRadiusM: next.radiusM,
                  geofencePolygon: next.polygon,
                }));
              }}
            />
          </Section>
        ) : null}

        {/* --------------------------------------------------------- media */}
        {tab === "media" ? (
          <Section title={`Gallery (${draft.gallery.length})`}>
            <p className="text-xs text-muted-foreground">
              Every image needs an attribution and a licence before it can be
              published. Seeds ship with these unfilled on purpose — we will not
              fake attribution.
            </p>
            <ul className="space-y-2">
              {draft.gallery.map((m, i) => (
                <li key={m.id} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[8rem_1fr]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, color-mix(in srgb, var(--color-tier-${draft.tier}) 70%, #000), color-mix(in srgb, var(--color-tier-${draft.tier}) 30%, #000))`,
                      }}
                    />
                    {i === 0 ? (
                      <Badge variant="default" className="absolute top-2 left-2">
                        Hero
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Input
                      value={m.caption ?? ""}
                      placeholder="Caption"
                      aria-label={`Image ${i + 1} caption`}
                      onChange={(e) => {
                        const gallery = [...draft.gallery];
                        gallery[i] = { ...m, caption: e.target.value };
                        set("gallery", gallery);
                      }}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={m.attribution}
                        placeholder="Attribution (required)"
                        aria-label={`Image ${i + 1} attribution`}
                        onChange={(e) => {
                          const gallery = [...draft.gallery];
                          gallery[i] = { ...m, attribution: e.target.value };
                          set("gallery", gallery);
                        }}
                      />
                      <Input
                        value={m.licence}
                        placeholder="Licence (required)"
                        aria-label={`Image ${i + 1} licence`}
                        onChange={(e) => {
                          const gallery = [...draft.gallery];
                          gallery[i] = { ...m, licence: e.target.value };
                          set("gallery", gallery);
                        }}
                      />
                    </div>
                    {m.licence === "TBD" ? (
                      <p className="text-xs text-warning">
                        Blocks publication — licence not cleared.
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* ------------------------------------------------------- publish */}
        {tab === "publish" ? (
          <>
            <Section title="Publication status">
              <div className="grid gap-3 sm:grid-cols-4">
                {(["draft", "in_review", "published", "suppressed"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={draft.status === s}
                    onClick={() => set("status", s)}
                    className={cn(
                      "rounded-lg border p-3 text-left text-sm font-medium capitalize",
                      draft.status === s ? "border-primary bg-primary-soft" : "border-border",
                    )}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                State admins edit and move to review; a super admin publishes, so
                that content reads consistently across state boundaries.
                &ldquo;Suppressed&rdquo; keeps the listing live but removes it
                from promotion — the lever for an ecologically stressed site.
              </p>
            </Section>

            <Section title="Pre-publication checklist">
              <ul className="space-y-2 text-sm">
                {[
                  { label: "Short description written", ok: draft.shortDescription.length > 40 },
                  { label: "Why-go written", ok: draft.whyGo.length > 80 },
                  { label: "Story over 200 characters", ok: draft.story.length > 200 },
                  { label: "At least 4 things to do", ok: draft.thingsToDo.length >= 4 },
                  { label: "Itinerary has 4+ stops", ok: draft.itinerary.stops.length >= 4 },
                  { label: "Timings recorded", ok: draft.info.timings.length > 0 },
                  { label: "Entry fees recorded", ok: draft.info.entryFees.length > 0 },
                  { label: "How to reach written", ok: draft.info.howToReach.length > 60 },
                  { label: "Emergency contacts present", ok: draft.info.emergencyContacts.length > 0 },
                  { label: "Geofence radius set", ok: draft.geofenceRadiusM > 0 },
                  { label: "3+ gallery images", ok: draft.gallery.length >= 3 },
                  {
                    label: "All image licences cleared",
                    ok: draft.gallery.every((m) => m.licence !== "TBD"),
                  },
                  { label: "Points rationale written", ok: draft.pointsRationale.length > 0 },
                ].map((c) => (
                  <li key={c.label} className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                        c.ok ? "bg-success/15 text-success" : "bg-danger/12 text-danger",
                      )}
                    >
                      {c.ok ? "✓" : "!"}
                    </span>
                    <span className={c.ok ? "text-muted-foreground" : "font-medium"}>
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Preview">
              <Link
                href={`/destinations/${draft.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open the public listing
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
}
