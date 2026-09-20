"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { formatNumber, relativeTime } from "@/lib/format";
import type { DestinationStatus, Tier } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Column } from "./data-table";

export interface AdminDestinationRow {
  id: string;
  slug: string;
  name: string;
  district: string;
  stateCode: string;
  tier: Tier;
  status: DestinationStatus;
  basePoints: number;
  checkInCount: number;
  updatedAt: string;
  completeness: number;
}

const STATUS_VARIANT: Record<DestinationStatus, "success" | "warning" | "muted" | "danger"> = {
  published: "success",
  in_review: "warning",
  draft: "muted",
  suppressed: "danger",
};

export function DestinationsTable({ rows }: { rows: AdminDestinationRow[] }) {
  const columns: Column<AdminDestinationRow>[] = [
    {
      key: "name",
      header: "Destination",
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-0">
          <Link
            href={`/admin/destinations/${r.slug}`}
            className="block truncate font-medium hover:underline"
          >
            {r.name}
          </Link>
          <span className="block truncate text-xs text-muted-foreground">
            {r.district} · {r.stateCode}
          </span>
        </div>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      sortValue: (r) => r.tier,
      className: "w-24",
      render: (r) => (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{
            background: `color-mix(in srgb, var(--color-tier-${r.tier}) 14%, transparent)`,
            color: `var(--color-tier-${r.tier})`,
          }}
        >
          T{r.tier} · {r.basePoints}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      className: "w-28",
      render: (r) => (
        <Badge variant={STATUS_VARIANT[r.status]}>{r.status.replace("_", " ")}</Badge>
      ),
    },
    {
      key: "completeness",
      header: "Content",
      sortValue: (r) => r.completeness,
      className: "w-40",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Progress
            value={r.completeness}
            className="h-1.5 w-20"
            barClassName={r.completeness >= 90 ? "bg-success" : r.completeness >= 70 ? "bg-warning" : "bg-danger"}
            label={`${r.name} content completeness`}
          />
          <span className="text-xs tabular-nums">{r.completeness}%</span>
        </div>
      ),
    },
    {
      key: "checkIns",
      header: "Check-ins",
      sortValue: (r) => r.checkInCount,
      className: "w-28 text-right",
      render: (r) => (
        <span className="block text-right tabular-nums">
          {formatNumber(r.checkInCount)}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      sortValue: (r) => r.updatedAt,
      className: "w-32",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {relativeTime(r.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-16",
      render: (r) => (
        <Link
          href={`/admin/destinations/${r.slug}`}
          aria-label={`Edit ${r.name}`}
          className="inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3.5" aria-hidden />
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      searchKeys={(r) => `${r.name} ${r.district} ${r.slug}`}
      searchPlaceholder="Search destinations or districts…"
      initialSort={{ key: "completeness", dir: "asc" }}
      emptyTitle="No destinations match"
    />
  );
}
