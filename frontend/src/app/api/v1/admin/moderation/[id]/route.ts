import { decideModeration, getModerationItem, resetModeration } from "@/mocks/db";
import { badRequest, notFound, ok } from "../../../_lib";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = getModerationItem(id);
  return item ? ok(item) : notFound(`No queue item "${id}"`);
}

/** POST /v1/admin/moderation/:id/decide, collapsed onto the item route. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    decision?: string;
    reason?: string;
  };

  if (body.decision === "reset") {
    const item = resetModeration(id);
    return item ? ok(item) : notFound(`No queue item "${id}"`);
  }
  if (body.decision !== "approved" && body.decision !== "rejected") {
    return badRequest('decision must be "approved", "rejected" or "reset"');
  }
  const item = decideModeration(id, body.decision, body.reason);
  return item ? ok(item) : notFound(`No queue item "${id}"`);
}
