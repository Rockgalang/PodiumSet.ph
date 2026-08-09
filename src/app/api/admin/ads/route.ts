import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { addAdUpdate } from "@/lib/queries";

export async function POST(req: Request) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  let body: { subscription_id?: number; month?: string; summary?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const subscriptionId = Number(body.subscription_id);
  if (!subscriptionId) return err("subscription_id is required.");
  await addAdUpdate(
    subscriptionId,
    String(body.month ?? new Date().toISOString().slice(0, 7)),
    String(body.summary ?? ""),
    String(body.notes ?? "")
  );
  return ok({ ok: true });
}
