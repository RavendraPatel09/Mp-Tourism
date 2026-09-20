import { Lock } from "lucide-react";
import { listAuditLogs } from "@/mocks/db";
import {
  AdminPageHeader,
  RequireCapability,
} from "@/components/admin/admin-shell";
import { AuditLogTable } from "@/components/admin/audit-log-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

export default function AdminAuditLogPage() {
  const rows = listAuditLogs();

  return (
    <RequireCapability capability="audit.read">
      <AdminPageHeader
        title="Audit log"
        description="Every administrative action, immutable and queryable. Non-negotiable for a government deployment."
      />

      <div className="space-y-6 p-6">
        <p className="inline-flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Append-only. Entries cannot be edited or deleted by any role,
          including Super Admin. Point reversals stay on the ledger alongside
          the original award rather than replacing it.
        </p>

        <AuditLogTable rows={rows} />
      </div>
    </RequireCapability>
  );
}
