import { search } from "@/mocks/db";
import { ok } from "../_lib";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok(search(q));
}
