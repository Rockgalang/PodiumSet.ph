import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { verifyPayment } from "@/lib/queries";
import { ensureClientFolder } from "@/lib/drive";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  let days = 30;
  try {
    const body = await req.json();
    const n = Number(body.days_granted);
    if (Number.isFinite(n) && n > 0 && n <= 365) days = Math.round(n);
  } catch {
    /* default 30 */
  }
  try {
    await verifyPayment(Number(id), s.user_id, days);
  } catch (e) {
    return err((e as Error).message);
  }
  const pay = await db
    .prepare("SELECT account_id FROM payment WHERE id = ?")
    .get(Number(id)) as { account_id: number } | undefined;
  if (pay) {
    // Create the client's Google Drive folder on onboarding (no-op if not configured).
    void await ensureClientFolder(pay.account_id).catch(() => null);
  }
  return ok({ ok: true });
}
