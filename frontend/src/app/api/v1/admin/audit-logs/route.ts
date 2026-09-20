import { listAuditLogs } from "@/mocks/db";
import { ok } from "../../_lib";

export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return ok(
    listAuditLogs({
      actor: sp.get("actor") ?? undefined,
      entity: sp.get("entity") ?? undefined,
      action: sp.get("action") ?? undefined,
    }),
  );
}
