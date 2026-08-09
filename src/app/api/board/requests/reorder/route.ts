import { err, ok, apiRequireClient } from "@/lib/route-auth";
import { reorderLineup } from "@/lib/queries";

export async function POST(req: Request) {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  if (!Array.isArray(body.ids)) return err("ids must be an array");
  await reorderLineup(s.account_id, body.ids.map(Number));
  return ok({ ok: true });
}
