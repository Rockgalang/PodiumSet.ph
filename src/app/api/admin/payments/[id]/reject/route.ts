import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { rejectPayment } from "@/lib/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  let reason = "";
  try {
    const body = await req.json();
    reason = String(body.reason ?? "").trim();
  } catch {
    /* ignore */
  }
  if (!reason) return err("A rejection reason is required.");
  try {
    await rejectPayment(Number(id), s.user_id, reason);
  } catch (e) {
    return err((e as Error).message);
  }
  return ok({ ok: true });
}
