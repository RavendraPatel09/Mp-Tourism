import { getState, listDistricts } from "@/mocks/db";
import { notFound, ok } from "../../../_lib";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!getState(code)) return notFound(`No state with code "${code}"`);
  return ok(listDistricts(code));
}
