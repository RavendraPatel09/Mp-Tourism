"use client";

import { formatDateTime, relativeTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/rbac";
import type { AuditLogEntry } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CsvExport } from "./csv-export";
import { DataTable, type Column } from "./data-table";

export function AuditLogTable({ rows }: { rows: AuditLogEntry[] }) {
  const columns: Column<AuditLogEntry>[] = [
    {
      key: "when",
      header: "When",
      sortValue: (r) => r.createdAt,
      className: "w-44",
      render: (r) => (
        <div>
          <span className="block text-sm">{formatDateTime(r.createdAt)}</span>
          <span className="block text-xs text-muted-foreground">
            {relativeTime(r.createdAt)}
          </span>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      sortValue: (r) => r.actor,
      className: "w-44",
      render: (r) => (
        <div>
          <span className="block font-medium">{r.actor}</span>
          <span className="block text-xs text-muted-foreground">
            {ROLE_LABEL[r.actorRole]}
          </span>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortValue: (r) => r.action,
      className: "w-52",
      render: (r) => (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {r.action}
        </code>
      ),
    },
    {
      key: "entity",
      header: "Entity",
      sortValue: (r) => r.entity,
      className: "w-32",
      render: (r) => <Badge variant="outline">{r.entity}</Badge>,
    },
    {
      key: "summary",
      header: "Summary",
      render: (r) => <span className="text-sm">{r.summary}</span>,
    },
    {
      key: "ip",
      header: "IP",
      className: "w-32",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">{r.ip}</span>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      searchKeys={(r) => `${r.actor} ${r.action} ${r.entity} ${r.summary}`}
      searchPlaceholder="Filter by actor, action, entity or text…"
      initialSort={{ key: "when", dir: "desc" }}
      toolbar={<CsvExport rows={rows} filename="audit-log.csv" />}
      emptyTitle="No matching audit entries"
    />
  );
}
