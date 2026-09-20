import { TrendingUp } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { formatNumber } from "@/lib/format";
import {
  AdminPageHeader,
  RequireCapability,
} from "@/components/admin/admin-shell";
import {
  CampaignLiftChart,
  DistrictChart,
  FootfallChart,
  SeasonalityChart,
  ShareTrendChart,
} from "@/components/admin/analytics-charts";
import { CsvExport } from "@/components/admin/csv-export";
import { StatTile } from "@/components/admin/stat-tile";
import { Progress } from "@/components/ui/progress";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-(--radius-card) border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default async function AdminAnalyticsPage() {
  const a = await serverApi.analytics();
  const sharePct = a.tier34Share * 100;
  const targetPct = a.tier34Target * 100;

  const firstWeekShare =
    a.footfall.slice(0, 7).reduce((s, p) => s + p.tier34, 0) /
    a.footfall.slice(0, 7).reduce((s, p) => s + p.checkIns, 0);
  const lastWeekShare =
    a.footfall.slice(-7).reduce((s, p) => s + p.tier34, 0) /
    a.footfall.slice(-7).reduce((s, p) => s + p.checkIns, 0);
  const shareDelta = (lastWeekShare - firstWeekShare) * 100;

  return (
    <RequireCapability capability="analytics.state">
      <AdminPageHeader
        title="Analytics"
        description="Ninety days of check-in data for the Madhya Pradesh pilot. Everything on this page is exportable."
        actions={
          <CsvExport
            rows={a.footfall}
            filename="yatrago-footfall-90d.csv"
            label="Export footfall"
          />
        }
      />

      <div className="space-y-6 p-6">
        {/* ------------------------------------------------- headline KPI */}
        <section className="rounded-(--radius-card) border-2 border-accent/30 bg-card p-6">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="size-4 text-accent" aria-hidden />
            Headline KPI — redistribution
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            The share of verified check-ins at Tier 3 and Tier 4 destinations.
            This is the number the whole product is judged on, and the one to
            put in front of a tourism board.
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-[18rem_1fr]">
            <div>
              <p className="text-5xl font-semibold tabular-nums text-accent">
                {sharePct.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                against a year-one target of {targetPct}%
              </p>
              <Progress
                value={(sharePct / targetPct) * 100}
                className="mt-4 h-3"
                barClassName="bg-accent"
                label="Progress to target"
              />
              <p
                className={`mt-3 text-sm font-medium ${shareDelta >= 0 ? "text-success" : "text-danger"}`}
              >
                {shareDelta >= 0 ? "+" : ""}
                {shareDelta.toFixed(1)} pts over the 90-day window
              </p>
            </div>

            <div>
              <ShareTrendChart data={a.footfall} />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- stat row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Check-ins, 90 days"
            value={formatNumber(a.totalCheckIns)}
          />
          <StatTile
            label="Destinations with a check-in"
            value={`${a.uniqueDestinationsVisited} of ${a.publishedDestinations}`}
            sub="Year-one target is 4,000+ nationally"
          />
          <StatTile label="Active explorers" value={formatNumber(a.activeExplorers)} />
          <StatTile
            label="Median moderation turnaround"
            value={`${a.avgReviewHours} h`}
            sub="SLA is under 12 hours"
            tone={a.avgReviewHours < 12 ? "success" : "danger"}
          />
        </div>

        <Panel
          title="Footfall over time, split by tier"
          description="The band that matters is the orange one. If it is not growing as a share, the incentive is not working."
        >
          <FootfallChart data={a.footfall} />
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="Footfall by district"
            description="Orange bars are districts already above a 50% Tier 3+4 share."
            action={
              <CsvExport
                rows={a.byDistrict}
                filename="footfall-by-district.csv"
                label="Export"
              />
            }
          >
            <DistrictChart data={a.byDistrict} />
          </Panel>

          <Panel
            title="Seasonality"
            description="The monsoon dip is the opportunity — it is why monsoon multipliers exist."
          >
            <SeasonalityChart data={a.seasonality} />
          </Panel>
        </div>

        <Panel
          title="Campaign lift — Monsoon on the Narmada"
          description="Check-ins in the 2× multiplier window against the equivalent window the previous year. This chart is the pitch to a state board."
          action={
            <CsvExport
              rows={a.campaignLift}
              filename="campaign-lift-monsoon-narmada.csv"
              label="Export"
            />
          }
        >
          <CampaignLiftChart data={a.campaignLift} />
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {a.campaignLift.map((c) => (
              <li key={c.destination} className="rounded-lg border border-border p-3">
                <p className="truncate text-xs text-muted-foreground">
                  {c.destination}
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-success">
                  +{c.liftPct}%
                </p>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="Visitor origin flows"
            description="Where visitors to Madhya Pradesh are travelling from."
            action={
              <CsvExport rows={a.originFlows} filename="origin-flows.csv" label="Export" />
            }
          >
            <ul className="space-y-2.5">
              {a.originFlows.map((o) => (
                <li key={o.originState} className="flex items-center gap-4">
                  <span className="w-36 shrink-0 truncate text-sm">
                    {o.originState}
                  </span>
                  <Progress
                    value={(o.visitors / a.originFlows[0].visitors) * 100}
                    label={`${o.originState} visitors`}
                  />
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums">
                    {formatNumber(o.visitors)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Check-ins by interest category"
            action={
              <CsvExport rows={a.byCategory} filename="by-category.csv" label="Export" />
            }
          >
            <ul className="space-y-2.5">
              {a.byCategory.slice(0, 10).map((c) => (
                <li key={c.category} className="flex items-center gap-4">
                  <span className="w-36 shrink-0 truncate text-sm">{c.category}</span>
                  <Progress
                    value={(c.checkIns / a.byCategory[0].checkIns) * 100}
                    label={`${c.category} check-ins`}
                  />
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums">
                    {formatNumber(c.checkIns)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </RequireCapability>
  );
}
