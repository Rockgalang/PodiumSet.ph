import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { getAccount, listPhases, listRequests } from "@/lib/queries";
import type { PhaseRow, RequestRow } from "@/lib/types";

type DashReq = Pick<
  RequestRow,
  "id" | "phase_id" | "position" | "target_completed_at" | "due_at" | "column"
> & {
  title: string;
  type_name: string;
  phase_name: string | null;
};

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

  const phases = await listPhases(accountId) as PhaseRow[];
  const requests = await listRequests(accountId) as DashReq[];

  const withPhases = phases.map((p) => ({
    ...p,
    requests: requests
      .filter((r) => r.phase_id === p.id)
      .sort((a, b) => a.position - b.position),
  }));
  const unassigned = requests
    .filter((r) => r.phase_id == null)
    .sort((a, b) => a.position - b.position);

  return ok({
    account: {
      id: account.id,
      business_name: account.business_name,
      contact_name: account.contact_name,
      email: account.email,
      viber: account.viber,
    },
    phases: withPhases,
    unassigned,
  });
}
