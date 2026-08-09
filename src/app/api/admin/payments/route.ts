import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { getPendingPayments } from "@/lib/queries";

export async function GET() {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  return ok({ payments: await getPendingPayments() });
}
