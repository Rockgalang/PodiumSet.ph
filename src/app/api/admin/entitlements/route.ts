import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { logEntitlement } from "@/lib/queries";

export async function POST(req: Request) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  let body: { account_id?: number; kind?: string; amount?: number; note?: string; month?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const accountId = Number(body.account_id);
  const kind = String(body.kind ?? "");
  const amount = Number(body.amount);
  if (!accountId || !kind || !Number.isFinite(amount))
    return err("account_id, kind and amount are required.");
  await logEntitlement({
    account_id: accountId,
    kind,
    amount,
    note: String(body.note ?? ""),
    month: typeof body.month === "string" && body.month ? body.month : undefined,
  });
  return ok({ ok: true });
}
