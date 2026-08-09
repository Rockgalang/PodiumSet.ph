import { err, apiAuth } from "@/lib/route-auth";
import { getRequest } from "@/lib/queries";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiAuth();
  if (!s) return err("Not signed in", 401);
  const { id } = await params;

  const row = await db
    .prepare("SELECT account_id FROM request WHERE id = ?")
    .get(Number(id)) as { account_id: number } | undefined;
  if (!row) return err("Request not found", 404);
  if (s.role === "client" && row.account_id !== s.account_id)
    return err("Request not found", 404);

  const detail = await getRequest(Number(id), row.account_id);
  if (!detail) return err("Request not found", 404);

  const allComments = (detail.comments as Array<Record<string, unknown>>).map(
    (c) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      author_email: c.author_email,
      author_role: c.author_role,
      author_account_id: c.author_account_id,
      internal_only: c.internal_only,
    })
  );
  const comments =
    s.role === "admin"
      ? allComments
      : allComments.filter((c) => c.internal_only === 0);

  const attachments = (
    detail.attachments as unknown as Array<{
      file_url: string;
      created_at: string;
    }>
  ).map((a) => ({ url: a.file_url, created_at: a.created_at }));

  return Response.json({
    id: detail.id,
    title: detail.title,
    column: detail.column,
    internal_status: detail.internal_status,
    revision_count: detail.revision_count,
    due_at: detail.due_at,
    approval_since: detail.approval_since,
    auto_approved: detail.auto_approved,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    target_completed_at: detail.target_completed_at,
    type_name: detail.type_name,
    type_slug: detail.type_slug,
    sla_hours: detail.sla_hours,
    business_name: detail.business_name,
    contact_name: detail.contact_name,
    brief_schema: detail.brief_schema_parsed,
    brief_answers: detail.brief_answers_parsed,
    deliverables: detail.deliverables,
    comments,
    attachments,
  });
}
