import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { updateSubtask, deleteSubtask } from "@/lib/queries";
import { db } from "@/lib/db";

const findSubtask = async (requestId: number, subtaskId: number) =>
  await db
    .prepare("SELECT id FROM subtask WHERE id = ? AND request_id = ?")
    .get(subtaskId, requestId);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id, subtaskId } = await params;
  const rid = Number(id);
  const sid = Number(subtaskId);
  if (!(await findSubtask(rid, sid))) return err("Subtask not found", 404);
  let body: { title?: string; done?: boolean };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  try {
    await updateSubtask(sid, {
      title: typeof body.title === "string" ? body.title : undefined,
      done: typeof body.done === "boolean" ? body.done : undefined,
    });
  } catch (e) {
    return err((e as Error).message, 404);
  }
  return ok({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id, subtaskId } = await params;
  const rid = Number(id);
  const sid = Number(subtaskId);
  if (!(await findSubtask(rid, sid))) return err("Subtask not found", 404);
  await deleteSubtask(sid);
  return ok({ ok: true });
}