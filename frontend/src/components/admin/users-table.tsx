"use client";

import * as React from "react";
import { AlertTriangle, Ban, ShieldAlert, Undo2 } from "lucide-react";
import { formatDate, formatNumber, initials } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/rbac";
import type { AdminUser } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DataTable, type Column } from "./data-table";
import { CsvExport } from "./csv-export";

const STATUS_VARIANT = {
  active: "success",
  warned: "warning",
  suspended: "danger",
  banned: "danger",
} as const;

/** PRD F19 graduated enforcement: warning → reversal → suspension → ban. */
const ACTIONS = [
  { key: "warn", label: "Issue a warning", icon: AlertTriangle, tone: "warning" },
  { key: "reverse", label: "Reverse points", icon: Undo2, tone: "warning" },
  { key: "suspend", label: "Suspend from leaderboards (30 days)", icon: ShieldAlert, tone: "danger" },
  { key: "ban", label: "Ban the account", icon: Ban, tone: "danger" },
] as const;

export function UsersTable({ rows }: { rows: AdminUser[] }) {
  const [selected, setSelected] = React.useState<AdminUser | null>(null);
  const [applied, setApplied] = React.useState<string | null>(null);

  const columns: Column<AdminUser>[] = [
    {
      key: "user",
      header: "Explorer",
      sortValue: (r) => r.displayName,
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
            style={{ background: r.avatarColor }}
          >
            {initials(r.displayName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              @{r.username} · {r.stateCode}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortValue: (r) => r.role,
      className: "w-36",
      render: (r) => <Badge variant="outline">{ROLE_LABEL[r.role]}</Badge>,
    },
    {
      key: "trust",
      header: "Trust",
      sortValue: (r) => r.trustScore,
      className: "w-24",
      render: (r) => (
        <span
          className={`font-semibold tabular-nums ${r.trustScore < 40 ? "text-warning" : r.trustScore < 25 ? "text-danger" : "text-success"}`}
        >
          {r.trustScore}
        </span>
      ),
    },
    {
      key: "points",
      header: "Points",
      sortValue: (r) => r.totalPoints,
      className: "w-28 text-right",
      render: (r) => (
        <span className="block text-right tabular-nums">
          {formatNumber(r.totalPoints)}
        </span>
      ),
    },
    {
      key: "checkins",
      header: "Check-ins",
      sortValue: (r) => r.checkIns,
      className: "w-32 text-right",
      render: (r) => (
        <span className="block text-right text-sm tabular-nums">
          {r.checkIns}
          {r.rejectedCheckIns > 0 ? (
            <span className="ml-1.5 text-xs text-danger">
              −{r.rejectedCheckIns}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "verified",
      header: "Phone",
      sortValue: (r) => (r.isPhoneVerified ? 1 : 0),
      className: "w-24",
      render: (r) =>
        r.isPhoneVerified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="muted">Unverified</Badge>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      className: "w-28",
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>,
    },
    {
      key: "actions",
      header: "",
      className: "w-28",
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
          Enforce
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        searchKeys={(r) => `${r.displayName} ${r.username} ${r.stateCode}`}
        searchPlaceholder="Search by name or handle…"
        initialSort={{ key: "trust", dir: "asc" }}
        toolbar={<CsvExport rows={rows} filename="users.csv" />}
      />

      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setApplied(null);
        }}
        title={selected ? `Enforcement — @${selected.username}` : ""}
        description="Graduated enforcement. Every action is written to the immutable audit log with the acting moderator and a reason."
      >
        {selected ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Trust score</dt>
                <dd className="font-semibold tabular-nums">{selected.trustScore}/100</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Rejected check-ins</dt>
                <dd className="font-semibold tabular-nums">
                  {selected.rejectedCheckIns} of {selected.checkIns}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Joined</dt>
                <dd>{formatDate(selected.joinedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd>{selected.isPhoneVerified ? "Verified" : "Not verified"}</dd>
              </div>
            </dl>

            {applied ? (
              <p className="rounded-lg bg-success/12 p-3 text-sm text-success">
                {applied} applied and written to the audit log. The explorer can
                appeal once.
              </p>
            ) : (
              <ul className="space-y-2">
                {ACTIONS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <li key={a.key}>
                      <button
                        type="button"
                        onClick={() => setApplied(a.label)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border border-border p-3 text-left text-sm hover:bg-muted ${a.tone === "danger" ? "hover:border-danger" : "hover:border-warning"}`}
                      >
                        <Icon
                          className={`size-4 ${a.tone === "danger" ? "text-danger" : "text-warning"}`}
                          aria-hidden
                        />
                        {a.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
