import { getDestination, reviewsForDestination } from "@/mocks/db";
import { notFound, ok } from "../../../_lib";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!getDestination(slug)) return notFound(`No destination with slug "${slug}"`);
  return ok(reviewsForDestination(slug));
}
