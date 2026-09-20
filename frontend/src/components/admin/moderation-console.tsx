"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Keyboard,
  Undo2,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { ModerationItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Photo } from "@/components/public/photo";
import { VerificationSignals } from "./verification-signals";
import { cn } from "@/lib/utils";

const MapView = dynamic(
  () => import("@/components/public/map-view").then((m) => m.MapView),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

const REJECT_REASONS = [
  "Duplicate photo — pHash match",
  "Outside the geofence",
  "Mock location detected",
  "Photo is not of this destination",
  "Capture timestamp outside the window",
  "Impossible travel velocity",
];

/**
 * The moderation console.
 *
 * TEAM_PLAN: "This is where moderator hours are won or lost — make it fast."
 * So it is keyboard-first: A approve, R reject, → / J next, ← / K previous,
 * U undo the last decision. The mouse is the fallback, not the primary input.
 */
export function ModerationConsole({ initial }: { initial: ModerationItem[] }) {
  const qc = useQueryClient();
  const [index, setIndex] = React.useState(0);
  const [lastDecided, setLastDecided] = React.useState<string | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const { data: queue = initial } = useQuery({
    queryKey: ["moderation", "pending"],
    queryFn: () => api.admin.moderationQueue("pending"),
    initialData: initial,
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: "approved" | "rejected" | "reset";
      reason?: string;
    }) => api.admin.decide(id, decision, reason),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["moderation"] });
      if (vars.decision === "reset") {
        setToast("Decision undone — item back in the queue");
        setLastDecided(null);
      } else {
        setLastDecided(vars.id);
        setToast(
          vars.decision === "approved"
            ? "Approved — points credited"
            : `Rejected${vars.reason ? ` — ${vars.reason}` : ""}`,
        );
        setIndex((i) => Math.min(i, Math.max(0, queue.length - 2)));
      }
      window.setTimeout(() => setToast(null), 3000);
    },
  });

  const item = queue[index];

  const approve = React.useCallback(() => {
    if (item) decide.mutate({ id: item.id, decision: "approved" });
  }, [item, decide]);

  const reject = React.useCallback(
    (reason?: string) => {
      if (item) decide.mutate({ id: item.id, decision: "rejected", reason });
      setRejecting(false);
    },
    [item, decide],
  );

  const undo = React.useCallback(() => {
    if (lastDecided) decide.mutate({ id: lastDecided, decision: "reset" });
  }, [lastDecided, decide]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          approve();
          break;
        case "r":
          e.preventDefault();
          setRejecting((v) => !v);
          break;
        case "u":
          e.preventDefault();
          undo();
          break;
        case "arrowright":
        case "j":
          e.preventDefault();
          setIndex((i) => Math.min(i + 1, queue.length - 1));
          break;
        case "arrowleft":
        case "k":
          e.preventDefault();
          setIndex((i) => Math.max(i - 1, 0));
          break;
        case "escape":
          setRejecting(false);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approve, undo, queue.length]);

  if (queue.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Check className="size-8 text-success" />}
          title="Queue is clear"
          description="Nothing pending review. Auto-approved submissions are still sampled for random audit."
          action={
            lastDecided ? (
              <Button variant="outline" onClick={undo} className="gap-1.5">
                <Undo2 className="size-3.5" aria-hidden />
                Undo last decision
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (!item) return null;

  const failing = item.signals.filter((s) => s.status === "fail");
  const warning = item.signals.filter((s) => s.status === "warn");

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* ------------------------------------------------------- toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{index + 1}</span>
          <span className="text-muted-foreground"> of {queue.length} pending</span>
        </p>

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
            item.slaHoursRemaining <= 0
              ? "bg-danger/12 text-danger"
              : item.slaHoursRemaining < 4
                ? "bg-warning/14 text-warning"
                : "bg-muted text-muted-foreground",
          )}
        >
          <Clock className="size-3" aria-hidden />
          {item.slaHoursRemaining <= 0
            ? "Past the 12h SLA"
            : `${item.slaHoursRemaining}h of SLA left`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
          >
            ← Previous
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIndex((i) => Math.min(i + 1, queue.length - 1))}
            disabled={index >= queue.length - 1}
            className="gap-1"
          >
            Next <ChevronRight className="size-3.5" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={undo}
            disabled={!lastDecided}
            className="gap-1.5"
          >
            <Undo2 className="size-3.5" aria-hidden />
            Undo
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setRejecting((v) => !v)}
            className="gap-1.5"
          >
            <X className="size-3.5" aria-hidden />
            Reject <kbd className="ml-1 rounded bg-black/20 px-1 text-[10px]">R</kbd>
          </Button>
          <Button size="sm" onClick={approve} className="gap-1.5">
            <Check className="size-3.5" aria-hidden />
            Approve{" "}
            <kbd className="ml-1 rounded bg-black/20 px-1 text-[10px]">A</kbd>
          </Button>
        </div>
      </div>

      {rejecting ? (
        <div className="border-b border-border bg-danger/6 px-6 py-3">
          <p className="text-xs font-semibold text-danger">Reject with reason</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => reject(r)}
                className="rounded-full border border-danger/40 bg-card px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={() => reject()}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
            >
              No reason given
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="px-2 text-xs text-muted-foreground hover:underline"
            >
              Cancel (Esc)
            </button>
          </div>
        </div>
      ) : null}

      {/* -------------------------------------------------------- panes */}
      <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_1fr_22rem]">
        {/* submission */}
        <section className="border-b border-border p-5 lg:border-r lg:border-b-0" aria-label="Submitted photo">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wider uppercase">
              Submitted
            </h2>
            <span className="text-xs text-muted-foreground">
              {relativeTime(item.submittedAt)}
            </span>
          </div>
          <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-muted">
            <Photo
              media={{ url: item.photoUrl, caption: "Submitted photo" }}
              tier={item.tier}
              alt="Submitted check-in photo"
            />
          </div>
          <dl className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Captured</dt>
              <dd>{formatDateTime(item.capturedAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{formatDateTime(item.submittedAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Check-in ID</dt>
              <dd className="truncate font-mono text-[11px]">{item.checkInId}</dd>
            </div>
          </dl>
        </section>

        {/* reference */}
        <section className="border-b border-border p-5 lg:border-r lg:border-b-0" aria-label="Reference imagery">
          <h2 className="text-xs font-semibold tracking-wider uppercase">
            Reference gallery
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {item.referencePhotos.map((url, i) => (
              <div key={url} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                <Photo
                  media={{ url, caption: `Reference ${i + 1}` }}
                  tier={item.tier}
                  alt={`Reference photo ${i + 1} for ${item.destinationName}`}
                />
              </div>
            ))}
          </div>

          <h2 className="mt-5 text-xs font-semibold tracking-wider uppercase">
            GPS against the geofence
          </h2>
          <div className="mt-3 h-52 overflow-hidden rounded-xl border border-border">
            <MapView
              pins={[
                {
                  slug: item.destinationSlug,
                  name: item.destinationName,
                  tier: item.tier,
                  district: item.stateCode,
                  location: item.deviceLocation,
                },
              ]}
              center={item.destinationLocation}
              zoom={item.geofenceRadiusM > 2000 ? 12 : 15}
              fitToPins={false}
              geofence={{
                centre: item.destinationLocation,
                radiusM: item.geofenceRadiusM,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Device {item.distanceFromCentreM} m from centre · fence{" "}
            {item.geofenceRadiusM} m · reported accuracy ±{item.accuracyM} m
          </p>
        </section>

        {/* signals + user */}
        <aside className="space-y-5 bg-muted/30 p-5" aria-label="Verification signals and user history">
          <div>
            <h2 className="text-sm font-semibold">{item.destinationName}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tier {item.tier} ·{" "}
              <span className="font-semibold text-foreground">
                {item.pointsAtStake} points
              </span>{" "}
              at stake
            </p>
            <Link
              href={`/destinations/${item.destinationSlug}`}
              target="_blank"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open listing <ExternalLink className="size-3" aria-hidden />
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wider uppercase">
                Automated signals
              </h3>
              {failing.length > 0 ? (
                <Badge variant="danger">
                  <AlertTriangle className="size-3" aria-hidden />
                  {failing.length} failed
                </Badge>
              ) : warning.length > 0 ? (
                <Badge variant="warning">{warning.length} to review</Badge>
              ) : (
                <Badge variant="success">All passed</Badge>
              )}
            </div>
            <div className="mt-2">
              <VerificationSignals signals={item.signals} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase">
              Submitter history
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Account</dt>
                <dd className="font-medium">@{item.username}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Trust score</dt>
                <dd
                  className={`font-semibold tabular-nums ${item.userTrustScore < 40 ? "text-warning" : "text-success"}`}
                >
                  {item.userTrustScore}/100
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Total check-ins</dt>
                <dd className="tabular-nums">{item.userCheckInCount}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Previously rejected</dt>
                <dd
                  className={`tabular-nums ${item.userRejectionCount > 3 ? "text-danger" : ""}`}
                >
                  {item.userRejectionCount}
                </dd>
              </div>
            </dl>
            <Link
              href={`/admin/users?q=${item.username}`}
              className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
            >
              Full user record
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Keyboard className="size-3.5" aria-hidden />
              Shortcuts
            </h3>
            <dl className="mt-2.5 space-y-1.5 text-xs">
              {[
                ["A", "Approve and credit points"],
                ["R", "Open reject reasons"],
                ["→ / J", "Next item"],
                ["← / K", "Previous item"],
                ["U", "Undo the last decision"],
                ["Esc", "Cancel reject"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-2">
                  <dt>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      {key}
                    </kbd>
                  </dt>
                  <dd className="text-muted-foreground">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
