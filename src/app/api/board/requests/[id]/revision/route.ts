import { err, ok, apiRequireClient } from "@/lib/route-auth";
import { requestRevision } from "@/lib/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  const { id } = await params;
  let body: { note?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const note = (body.note ?? "").trim();
  if (!note) return err("Tell us what to change.");
  try {
    await requestRevision(s.account_id, Number(id), {
      actorId: s.user_id,
      note,
      isClient: true,
    });
  } catch (e) {
    return err((e as Error).message);
  }
  return ok({ ok: true });
}
