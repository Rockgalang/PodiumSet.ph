import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { renamePhase, deletePhase } from "@/lib/queries";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { phaseId } = await params;
  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const name = String(body.name ?? "").trim();
  if (!name) return err("Phase name is required.");
  try {
    await renamePhase(Number(phaseId), name);
  } catch (e) {
    return err((e as Error).message, 404);
  }
  return ok({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { phaseId } = await params;
  try {
    await deletePhase(Number(phaseId));
  } catch (e) {
    return err((e as Error).message, 404);
  }
  return ok({ ok: true });
}
