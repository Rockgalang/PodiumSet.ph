import { err, ok, apiRequireClient } from "@/lib/route-auth";
import { approveRequest } from "@/lib/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  const { id } = await params;
  let note = "";
  try {
    const body = await req.json();
    note = typeof body.note === "string" ? body.note : "";
  } catch {
    /* no note */
  }
  try {
    await approveRequest(s.account_id, Number(id), {
      actorId: s.user_id,
      note: note || undefined,
    });
  } catch (e) {
    return err((e as Error).message);
  }
  return ok({ ok: true });
}
