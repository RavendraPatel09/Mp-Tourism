import { getCircuit } from "@/mocks/db";
import { notFound, ok } from "../../_lib";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const circuit = getCircuit(slug);
  if (!circuit) return notFound(`No circuit with slug "${slug}"`);
  return ok(circuit);
}
