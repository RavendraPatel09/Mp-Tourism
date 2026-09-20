import { listAdminUsers } from "@/mocks/db";
import {
  AdminPageHeader,
  RequireCapability,
} from "@/components/admin/admin-shell";
import { StatTile } from "@/components/admin/stat-tile";
import { UsersTable } from "@/components/admin/users-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default function AdminUsersPage() {
  const users = listAdminUsers();
  const lowTrust = users.filter((u) => u.trustScore < 40).length;
  const unverified = users.filter((u) => !u.isPhoneVerified).length;
  const flagged = users.filter((u) => u.status !== "active").length;

  return (
    <RequireCapability capability="users.manage">
      <AdminPageHeader
        title="Users"
        description="Trust scores, check-in history and graduated enforcement. Phone verification is required before any monetary reward — which is Phase 2, so nothing here is worth money yet."
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Registered explorers" value={users.length} />
          <StatTile
            label="Low trust (under 40)"
            value={lowTrust}
            sub="Submissions held for manual review"
            tone={lowTrust > 0 ? "warning" : "default"}
          />
          <StatTile label="Phone unverified" value={unverified} />
          <StatTile
            label="Under enforcement"
            value={flagged}
            tone={flagged > 0 ? "danger" : "success"}
          />
        </div>

        <UsersTable rows={users} />
      </div>
    </RequireCapability>
  );
}
