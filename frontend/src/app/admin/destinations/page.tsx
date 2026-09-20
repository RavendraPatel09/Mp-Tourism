import { Plus } from "lucide-react";
import { completeness, listAllDestinations } from "@/mocks/db";
import {
  AdminPageHeader,
  RequireCapability,
} from "@/components/admin/admin-shell";
import {
  DestinationsTable,
  type AdminDestinationRow,
} from "@/components/admin/destinations-table";
import { StatTile } from "@/components/admin/stat-tile";

export const dynamic = "force-dynamic";
export const metadata = { title: "Destinations" };

export default function AdminDestinationsPage() {
  const rows: AdminDestinationRow[] = listAllDestinations().map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    district: d.district,
    stateCode: d.stateCode,
    tier: d.tier,
    status: d.status,
    basePoints: d.basePoints,
    checkInCount: d.checkInCount,
    updatedAt: d.updatedAt,
    completeness: completeness(d),
  }));

  const published = rows.filter((r) => r.status === "published").length;
  const complete = rows.filter((r) => r.completeness >= 90).length;
  const tier34 = rows.filter((r) => r.tier >= 3).length;

  return (
    <RequireCapability capability="destinations.read">
      <AdminPageHeader
        title="Destinations"
        description="The catalogue is curated, not crowdsourced — quality is the thing that breaks first at scale. Local Guides can submit corrections from Level 5."
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" aria-hidden />
            New destination
          </button>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Total listings" value={rows.length} />
          <StatTile
            label="Published"
            value={published}
            sub={`${rows.length - published} in draft or review`}
            tone="success"
          />
          <StatTile
            label="Complete visitor info"
            value={`${Math.round((complete / rows.length) * 100)}%`}
            sub={`${complete} of ${rows.length} at 90%+ · target 90%`}
            tone={complete / rows.length >= 0.9 ? "success" : "warning"}
          />
          <StatTile
            label="Tier 3 & 4"
            value={`${tier34} of ${rows.length}`}
            sub="The catalogue has to embody the thesis too"
            tone="accent"
          />
        </div>

        <DestinationsTable rows={rows} />
      </div>
    </RequireCapability>
  );
}
