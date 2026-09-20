import type { Metadata } from "next";
import { serverApi } from "@/lib/api/server";
import { LeaderboardTable } from "@/components/public/leaderboard-table";

export const metadata: Metadata = {
  title: "Leaderboards",
  description:
    "National and state leaderboards. Ranked on points earned, which are weighted toward the least-visited destinations — so the top of the board is held by explorers who go off the map.",
  alternates: { canonical: "/leaderboards" },
};

export const revalidate = 600;

export default async function LeaderboardsPage() {
  const initial = await serverApi.leaderboard({ scope: "national", period: "all" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Leaderboards</h1>
      <p className="mt-2 text-muted-foreground">
        Because points are inverted against popularity, the fastest way up this
        board is not to visit more places — it is to visit less-visited ones.
        That is the whole design.
      </p>

      <div className="mt-8">
        <LeaderboardTable initial={initial} />
      </div>
    </div>
  );
}
