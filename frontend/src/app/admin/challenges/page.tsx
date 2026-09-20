import { serverApi } from "@/lib/api/server";
import {
  AdminPageHeader,
  RequireCapability,
} from "@/components/admin/admin-shell";
import { ChallengeCreator } from "@/components/admin/challenge-creator";

export const dynamic = "force-dynamic";
export const metadata = { title: "Challenges" };

export default async function AdminChallengesPage() {
  const [destinations, challenges] = await Promise.all([
    serverApi.destinations({ pageSize: 60, sort: "points" }),
    serverApi.challenges(),
  ]);

  return (
    <RequireCapability capability="challenges.manage">
      <AdminPageHeader
        title="Challenge creator"
        description="Time-boxed campaigns with a points multiplier. The preview shows what an explorer sees and what the campaign is worth, before you publish."
      />
      <div className="p-6">
        <ChallengeCreator destinations={destinations.items} existing={challenges} />
      </div>
    </RequireCapability>
  );
}
