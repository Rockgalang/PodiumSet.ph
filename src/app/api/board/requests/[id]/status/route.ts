import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import {
  promoteToOngoing,
  setInternalStatus,
  setTargetDate,
} from "@/lib/queries";
import { db } from "@/lib/db";
import type { InternalStatus } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  let body: {
    action?: string;
    internal_status?: string;
    target_date?: string;
  };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const row = await db
    .prepare("SELECT id, account_id, column FROM request WHERE id = ?")
    .get(Number(id)) as
    | { id: number; account_id: number | null; column: string }
    | undefined;
  if (!row) return err("Request not found", 404);

  try {
    if (body.action === "to_ongoing") {
      if (row.column !== "lineup")
        return err("Only Project Lineup cards can be promoted to Ongoing.");
      await promoteToOngoing(row.id, {
        actorId: s.user_id,
        accountId: row.account_id,
        targetDate: body.target_date || undefined,
        bypassSlots: true,
      });
    } else if (body.action === "internal_status") {
      const status = body.internal_status as InternalStatus | null;
      await setInternalStatus(row.id, status);
    } else if (body.action === "set_target") {
      if (!body.target_date) return err("Target date is required.");
      await setTargetDate(row.id, new Date(body.target_date).toISOString());
    } else {
      return err("Unknown action");
    }
  } catch (e) {
    return err((e as Error).message);
  }
  return ok({ ok: true });
}
