import { listBadges } from "@/mocks/db";
import { ok } from "../_lib";

export function GET() {
  return ok(listBadges());
}
