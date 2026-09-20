import { completeness, listAllDestinations, upsertDestination } from "@/mocks/db";
import { badRequest, notFound, ok } from "../../_lib";

/** Admin listing includes drafts and a completeness score; the public one does not. */
export function GET() {
  return ok(
    listAllDestinations().map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      district: d.district,
      stateCode: d.stateCode,
      tier: d.tier,
      status: d.status,
      basePoints: d.basePoints,
      checkInCount: d.checkInCount,
      updatedAt: d.updatedAt,
      completeness: completeness(d),
    })),
  );
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { slug?: string; patch?: Record<string, unknown> }
    | null;
  if (!body?.slug) return badRequest("slug is required");
  const updated = upsertDestination(body.slug, body.patch ?? {});
  return updated ? ok(updated) : notFound(`No destination "${body.slug}"`);
}
