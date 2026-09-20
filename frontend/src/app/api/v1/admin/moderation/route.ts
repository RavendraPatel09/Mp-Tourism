import type { ModerationItem } from "@/lib/types";
import { listModerationQueue } from "@/mocks/db";
import { ok } from "../../_lib";

export function GET(req: Request) {
  const status = (new URL(req.url).searchParams.get("status") ??
    "pending") as ModerationItem["status"] | "all";
  return ok(listModerationQueue(status));
}
