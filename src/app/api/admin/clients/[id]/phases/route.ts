import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { createPhase } from "@/lib/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const name = String(body.name ?? "").trim();
  if (!name) return err("Phase name is required.");
  const phaseId = await createPhase(Number(id), name);
  return ok({ ok: true, id: phaseId });
}
