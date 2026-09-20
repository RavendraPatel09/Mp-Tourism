import { getDestination } from "@/mocks/db";
import { notFound, ok } from "../../_lib";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const destination = getDestination(slug);
  if (!destination) return notFound(`No destination with slug "${slug}"`);
  return ok(destination);
}
