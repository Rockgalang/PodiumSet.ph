import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { saveClientBoard } from "@/lib/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  let body: { phases?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  if (!Array.isArray(body.phases)) return err("phases must be an array");
  try {
    const phases = body.phases.map((p) => {
      const rec = p as { id?: unknown; name?: unknown; request_ids?: unknown };
      const phId = Number(rec.id);
      if (!Number.isInteger(phId)) throw new Error("Invalid phase id");
      if (!Array.isArray(rec.request_ids))
        throw new Error("request_ids must be an array");
      return {
        id: phId,
        name: typeof rec.name === "string" ? rec.name : undefined,
        request_ids: rec.request_ids.map(Number),
      };
    });
    await saveClientBoard(Number(id), phases);
  } catch (e) {
    return err((e as Error).message);
  }
  return ok({ ok: true });
}
