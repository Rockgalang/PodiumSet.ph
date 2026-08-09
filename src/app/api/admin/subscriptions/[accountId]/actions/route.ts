import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { subscriptionAction } from "@/lib/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { accountId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const action = String(body.action ?? "");
  try {
    await subscriptionAction(Number(accountId), action, body, s.user_id);
  } catch (e) {
    return err((e as Error).message);
  }
  return ok({ ok: true });
}
