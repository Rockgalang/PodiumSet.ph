import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { db } from "@/lib/db";
import { deleteRequest } from "@/lib/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  const row = await db
    .prepare(
      `SELECT r.*, t.name AS type_name, t.slug AS type_slug, ph.name AS phase_name
       FROM request r
       JOIN request_type t ON t.id = r.request_type_id
       LEFT JOIN phase ph ON ph.id = r.phase_id
       WHERE r.id = ?`
    )
    .get(Number(id)) as
    | {
        id: number;
        account_id: number | null;
        request_type_id: number;
        title: string;
        column: string;
        phase_id: number | null;
        phase_name: string | null;
        target_completed_at: string | null;
        due_at: string | null;
        type_name: string;
        type_slug: string;
        created_at: string;
        other_client_name: string | null;
      }
    | undefined;
  if (!row) return err("Request not found", 404);
  return ok({ request: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  const requestId = Number(id);
  const row = await db
    .prepare(
      "SELECT id, phase_id, target_completed_at FROM request WHERE id = ?"
    )
    .get(requestId) as
    | { id: number; phase_id: number | null; target_completed_at: string | null }
    | undefined;
  if (!row) return err("Request not found", 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const title =
    typeof body.title === "string" ? body.title.trim() : undefined;
  const typeId =
    typeof body.request_type_id === "number"
      ? body.request_type_id
      : undefined;
  let phaseId: number | null | undefined;
  if (body.phase_id === null || body.phase_id === "") phaseId = null;
  else if (typeof body.phase_id === "number") phaseId = body.phase_id;
  let target: string | null | undefined;
  if (typeof body.target_completed_at === "string" && body.target_completed_at.trim())
    target = new Date(body.target_completed_at).toISOString();
  else if (body.target_completed_at === "" || body.target_completed_at === null)
    target = null;

  if (title !== undefined && !title)
    return err("Title can't be empty.");
  if (typeId !== undefined) {
    const rt = await db
      .prepare("SELECT id FROM request_type WHERE id = ?")
      .get(typeId);
    if (!rt) return err("Unknown request type.");
  }
  if (phaseId !== undefined && phaseId !== null) {
    const ph = await db.prepare("SELECT id FROM phase WHERE id = ?").get(phaseId);
    if (!ph) return err("Unknown phase.");
  }

  await db.prepare(
    `UPDATE request SET
       title = COALESCE(?, title),
       request_type_id = COALESCE(?, request_type_id),
       phase_id = ?,
       target_completed_at = ?,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title ?? null,
    typeId ?? null,
    phaseId !== undefined ? phaseId : row.phase_id,
    target !== undefined ? target : row.target_completed_at,
    requestId
  );

  return ok({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  const requestId = Number(id);
  try {
    await deleteRequest(requestId);
  } catch (e) {
    return err((e as Error).message, 404);
  }
  return ok({ ok: true });
}