import { getChallenge } from "@/mocks/db";
import { notFound, ok } from "../../_lib";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const challenge = getChallenge(slug);
  if (!challenge) return notFound(`No challenge with slug "${slug}"`);
  return ok(challenge);
}
