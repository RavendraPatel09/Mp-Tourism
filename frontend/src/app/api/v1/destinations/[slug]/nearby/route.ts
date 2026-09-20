import { getDestination, nearbyDestinations } from "@/mocks/db";
import { notFound, ok } from "../../../_lib";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!getDestination(slug)) return notFound(`No destination with slug "${slug}"`);
  const radius = Number(new URL(req.url).searchParams.get("radius") ?? 100);
  return ok(nearbyDestinations(slug, Number.isFinite(radius) ? radius : 100));
}
