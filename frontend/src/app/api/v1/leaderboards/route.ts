import { getLeaderboard } from "@/mocks/db";
import { ok } from "../_lib";

export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const scope = sp.get("scope") === "state" ? "state" : "national";
  const period = sp.get("period") === "month" ? "month" : "all";
  return ok(
    getLeaderboard({ scope, period, state: sp.get("state") ?? undefined }),
  );
}
