import { getProfile } from "@/mocks/db";
import { notFound, ok } from "../../_lib";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const profile = getProfile(username);
  if (!profile) return notFound(`No profile for "${username}"`);
  return ok(profile);
}
