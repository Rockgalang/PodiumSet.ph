import { err, ok, apiAuth } from "@/lib/route-auth";
import { addComment } from "@/lib/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiAuth();
  if (!s) return err("Not signed in", 401);
  const { id } = await params;
  let body: { body?: string; internal_only?: boolean };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const text = (body.body ?? "").trim();
  if (!text) return err("Comment cannot be empty.");
  const internalOnly = Boolean(body.internal_only);
  try {
    await addComment(
      s.account_id,
      Number(id),
      s.user_id,
      text,
      internalOnly,
      s.role
    );
  } catch (e) {
    return err((e as Error).message);
  }
  return ok({ ok: true });
}
