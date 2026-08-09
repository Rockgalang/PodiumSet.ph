import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { createSubtask, listSubtasks } from "@/lib/queries";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  const requestId = Number(id);
  const req = await db.prepare("SELECT id FROM request WHERE id = ?").get(requestId);
  if (!req) return err("Request not found", 404);
  return ok({ subtasks: await listSubtasks(requestId) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  const requestId = Number(id);
  const row = await db.prepare("SELECT id FROM request WHERE id = ?").get(requestId);
  if (!row) return err("Request not found", 404);
  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const title = String(body.title ?? "").trim();
  if (!title) return err("Subtask title is required.");
  const subtaskId = await createSubtask(requestId, title);
  return ok({ ok: true, id: subtaskId });
}