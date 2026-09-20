import { Flag, ShieldAlert } from "lucide-react";
import { relativeTime } from "@/lib/format";
import { leaderboard } from "@/mocks/seed/users";
import { destinations } from "@/mocks/seed/destinations";
import {
  AdminPageHeader,
  RequireCapability,
} from "@/components/admin/admin-shell";
import { StatTile } from "@/components/admin/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

/**
 * User reports queue (PRD F20). Auto-screening handles NSFW, violence and PII;
 * what reaches a human is everything else, plus appeals.
 */
const REPORTS = [
  {
    id: "rep-1",
    targetType: "review" as const,
    reason: "Abusive language",
    detail: "Review contains a personal attack on a named guide at the site.",
    autoScreen: "Text classifier flagged — confidence 0.91",
    severity: "high" as const,
    hoursAgo: 2,
  },
  {
    id: "rep-2",
    targetType: "photo" as const,
    reason: "Identifiable minor",
    detail: "Group photo at a temple with children's faces clearly visible.",
    autoScreen: "Face detection flagged 3 faces, 2 estimated under 18",
    severity: "high" as const,
    hoursAgo: 5,
  },
  {
    id: "rep-3",
    targetType: "review" as const,
    reason: "Factually wrong",
    detail: "Claims the site charges ₹500 entry. Listing and ASI both say ₹40.",
    autoScreen: "No automated flag — user reported",
    severity: "low" as const,
    hoursAgo: 9,
  },
  {
    id: "rep-4",
    targetType: "photo" as const,
    reason: "Visible number plate",
    detail: "Parked vehicle registration legible in the foreground.",
    autoScreen: "PII detector flagged — plate region detected",
    severity: "medium" as const,
    hoursAgo: 14,
  },
  {
    id: "rep-5",
    targetType: "profile" as const,
    reason: "Impersonation",
    detail: "Display name and avatar imitate the MP Tourism official account.",
    autoScreen: "No automated flag — user reported",
    severity: "medium" as const,
    hoursAgo: 22,
  },
  {
    id: "rep-6",
    targetType: "review" as const,
    reason: "Appeal against rejection",
    detail:
      "Explorer appealing a rejected check-in — says the photo is a genuine unlisted angle. One appeal permitted per decision.",
    autoScreen: "Original rejection: low scene-match similarity",
    severity: "medium" as const,
    hoursAgo: 30,
  },
];

const SEVERITY_VARIANT = { high: "danger", medium: "warning", low: "muted" } as const;

export default function AdminReportsPage() {
  const rows = REPORTS.map((r, i) => ({
    ...r,
    reporter: leaderboard[(i * 3) % leaderboard.length],
    destination: destinations[(i * 4) % destinations.length],
    createdAt: new Date(Date.now() - r.hoursAgo * 3_600_000).toISOString(),
  }));

  const high = rows.filter((r) => r.severity === "high").length;

  return (
    <RequireCapability capability="reports.review">
      <AdminPageHeader
        title="Reports"
        description="Reported reviews, photos and profiles. Auto-screening catches NSFW, violence and PII; what reaches this queue is everything else, plus appeals."
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open reports" value={rows.length} icon={<Flag className="size-4" />} />
          <StatTile
            label="High severity"
            value={high}
            sub="PII and abuse — handle first"
            tone={high > 0 ? "danger" : "success"}
            icon={<ShieldAlert className="size-4" />}
          />
          <StatTile label="Appeals" value={1} sub="One appeal permitted per decision" />
          <StatTile label="Median resolution" value="6.2 h" tone="success" />
        </div>

        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-(--radius-card) border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start gap-3">
                <Badge variant={SEVERITY_VARIANT[r.severity]}>
                  {r.severity} severity
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {r.targetType}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(r.createdAt)} · reported by @{r.reporter.username}
                </span>

                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline">
                    Dismiss
                  </Button>
                  <Button size="sm" variant="secondary">
                    Warn author
                  </Button>
                  <Button size="sm" variant="danger">
                    Remove content
                  </Button>
                </div>
              </div>

              <h2 className="mt-3 text-sm font-semibold">{r.reason}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
              <p className="mt-2.5 inline-block rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {r.autoScreen}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                On {r.destination.name}, {r.destination.district}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </RequireCapability>
  );
}
