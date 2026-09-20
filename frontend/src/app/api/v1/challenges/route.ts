import { listChallenges } from "@/mocks/db";
import { ok } from "../_lib";

export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return ok(
    listChallenges({
      scope: sp.get("scope") ?? undefined,
      state: sp.get("state") ?? undefined,
      active: sp.get("active") === "true",
    }),
  );
}
