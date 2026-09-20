import { parseDestinationQuery } from "@/lib/api/params";
import { queryDestinations } from "@/mocks/db";
import { ok } from "../_lib";

export function GET(req: Request) {
  const url = new URL(req.url);
  return ok(queryDestinations(parseDestinationQuery(url.searchParams)));
}
