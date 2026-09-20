import { listAdminUsers } from "@/mocks/db";
import { ok } from "../../_lib";

export function GET(req: Request) {
  return ok(listAdminUsers(new URL(req.url).searchParams.get("q") ?? undefined));
}
