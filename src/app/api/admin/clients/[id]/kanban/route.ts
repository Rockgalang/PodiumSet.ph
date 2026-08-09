import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import {
  getKanbanRequests,
  listPhases,
  saveClientKanban,
} from "@/lib/queries";
import { getAccount } from "@/lib/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  const accountId = Number(id);
  const account = await getAccount(accountId);
  if (!account) return err("Client not found", 404);
  return ok({
    requests: await getKanbanRequests(accountId),
    phases: await listPhases(accountId),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  const accountId = Number(id);
  const account = await getAccount(accountId);
  if (!account) return err("Client not found", 404);

  let body: { columns?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const cols = body.columns;
  if (!cols || typeof cols !== "object" || Array.isArray(cols))
    return err("columns must be an object of arrays");
  try {
    const columns: Record<string, number[]> = {};
    for (const [col, ids] of Object.entries(cols)) {
      if (!Array.isArray(ids))
        return err(`column "${col}" must be an array of request ids`);
      columns[col] = ids.map(Number);
    }
    await saveClientKanban(accountId, columns);
  } catch (e) {
    return err((e as Error).message);
  }
  return ok({ ok: true });
}
