import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  MapPinned,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { formatNumber, relativeTime } from "@/lib/format";
import { listAuditLogs, listModerationQueue } from "@/mocks/db";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { StatTile } from "@/components/admin/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const analytics = await serverApi.analytics();
  const queue = listModerationQueue("pending");
  const audit = listAuditLogs().slice(0, 8);

  const overdue = queue.filter((q) => q.slaHoursRemaining <= 0).length;
  const sharePct = analytics.tier34Share * 100;
  const targetPct = analytics.tier34Target * 100;
  const last7 = analytics.footfall.slice(-7);
  const prev7 = analytics.footfall.slice(-14, -7);
  const last7Total = last7.reduce((s, p) => s + p.checkIns, 0);
  const prev7Total = prev7.reduce((s, p) => s + p.checkIns, 0);
  const weekDelta = Math.round(((last7Total - prev7Total) / prev7Total) * 100);

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="Madhya Pradesh pilot. The headline number is the Tier 3+4 share — everything else on this page is context for it."
      />

      <div className="space-y-8 p-6">
        {/* ------------------------------------------------- headline KPI */}
        <section
          className="rounded-(--radius-card) border border-border bg-card p-6"
          aria-labelledby="kpi-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h2
                id="kpi-heading"
                className="inline-flex items-center gap-2 text-sm font-semibold"
              >
                <TrendingUp className="size-4 text-accent" aria-hidden />
                Redistribution KPI — share of check-ins at Tier 3 &amp; 4
              </h2>
              <p className="mt-3 flex items-baseline gap-3">
                <span className="text-5xl font-semibold tabular-nums text-accent">
                  {sharePct.toFixed(1)}%
                </span>
                <span
                  className={`text-sm font-medium ${sharePct >= targetPct ? "text-success" : "text-warning"}`}
                >
                  {sharePct >= targetPct
                    ? `${(sharePct - targetPct).toFixed(1)} pts above target`
                    : `${(targetPct - sharePct).toFixed(1)} pts below target`}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Year-one target is {targetPct}%. Measured over the last 90 days,{" "}
                {formatNumber(analytics.totalCheckIns)} check-ins.
              </p>
            </div>

            <div className="min-w-56 flex-1">
              <Progress
                value={(sharePct / targetPct) * 100}
                barClassName="bg-accent"
                label="Progress to the Tier 3+4 target"
                className="h-3"
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>target {targetPct}%</span>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- stat row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Pending moderation"
            value={queue.length}
            sub={overdue > 0 ? `${overdue} past the 12h SLA` : "All within SLA"}
            tone={overdue > 0 ? "danger" : "default"}
            icon={<ShieldCheck className="size-4" />}
          />
          <StatTile
            label="Check-ins, last 7 days"
            value={formatNumber(last7Total)}
            sub={`${weekDelta >= 0 ? "+" : ""}${weekDelta}% on the previous week`}
            tone={weekDelta >= 0 ? "success" : "warning"}
            icon={<TrendingUp className="size-4" />}
          />
          <StatTile
            label="Published destinations"
            value={analytics.publishedDestinations}
            sub={`${analytics.uniqueDestinationsVisited} have had at least one check-in`}
            icon={<MapPinned className="size-4" />}
          />
          <StatTile
            label="Active explorers"
            value={formatNumber(analytics.activeExplorers)}
            sub={`Median review turnaround ${analytics.avgReviewHours} h`}
            icon={<Users className="size-4" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ------------------------------------------- moderation queue */}
          <section
            className="rounded-(--radius-card) border border-border bg-card"
            aria-labelledby="queue-heading"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <h2 id="queue-heading" className="text-sm font-semibold">
                Moderation queue
              </h2>
              <Link
                href="/admin/moderation"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open console <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>

            <ul className="divide-y divide-border">
              {queue.slice(0, 6).map((item) => {
                const failing = item.signals.filter((s) => s.status === "fail");
                return (
                  <li key={item.id} className="flex items-center gap-3 p-4">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold"
                      style={{
                        background: `color-mix(in srgb, var(--color-tier-${item.tier}) 14%, transparent)`,
                        color: `var(--color-tier-${item.tier})`,
                      }}
                    >
                      T{item.tier}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.destinationName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        @{item.username} · trust {item.userTrustScore} ·{" "}
                        {item.pointsAtStake} pts at stake
                      </span>
                    </span>
                    {failing.length > 0 ? (
                      <Badge variant="danger" className="shrink-0">
                        <AlertTriangle className="size-3" aria-hidden />
                        {failing.length} failed
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="shrink-0">
                        Low trust
                      </Badge>
                    )}
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 text-xs ${item.slaHoursRemaining <= 0 ? "text-danger" : "text-muted-foreground"}`}
                    >
                      <Clock className="size-3" aria-hidden />
                      {item.slaHoursRemaining <= 0
                        ? "overdue"
                        : `${item.slaHoursRemaining}h`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* -------------------------------------------------- audit log */}
          <section
            className="rounded-(--radius-card) border border-border bg-card"
            aria-labelledby="audit-heading"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <h2 id="audit-heading" className="text-sm font-semibold">
                Recent admin activity
              </h2>
              <Link
                href="/admin/audit-logs"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Full log <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>

            <ul className="divide-y divide-border">
              {audit.map((a) => (
                <li key={a.id} className="p-4">
                  <p className="text-sm">{a.summary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1">{a.action}</code> ·{" "}
                    {a.actor} · {relativeTime(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ------------------------------------------------ top districts */}
        <section
          className="rounded-(--radius-card) border border-border bg-card"
          aria-labelledby="districts-heading"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border p-5">
            <h2 id="districts-heading" className="text-sm font-semibold">
              Footfall by district
            </h2>
            <Link
              href="/admin/analytics"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Full analytics <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>

          <ul className="divide-y divide-border">
            {analytics.byDistrict.slice(0, 8).map((d) => (
              <li key={d.district} className="flex items-center gap-4 p-4">
                <span className="w-40 shrink-0 truncate text-sm font-medium">
                  {d.district}
                </span>
                <span className="flex-1">
                  <Progress
                    value={(d.checkIns / analytics.byDistrict[0].checkIns) * 100}
                    label={`${d.district} check-ins`}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                  {formatNumber(d.checkIns)}
                </span>
                <span
                  className={`w-20 shrink-0 text-right text-sm font-medium tabular-nums ${d.tier34Share >= 0.35 ? "text-success" : "text-muted-foreground"}`}
                >
                  {Math.round(d.tier34Share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
