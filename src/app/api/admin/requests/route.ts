import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import {
  createManualRequest,
  getAccount,
  getRequestType,
} from "@/lib/queries";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);

  let body: {
    client_id?: number | null;
    other_client_name?: string;
    other_client_email?: string;
    other_client_mobile?: string;
    other_client_viber?: string;
    request_type_id?: number;
    title?: string;
    brief?: Record<string, unknown>;
    target_completed_at?: string | null;
    viber?: string;
    phase_id?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const rt = await getRequestType(Number(body.request_type_id));
  if (!rt) return err("Unknown request type.");
  const title = String(body.title ?? "").trim();
  if (!title) return err("Give the project a title.");

  const clientId = body.client_id ? Number(body.client_id) : null;
  let accountId: number | null = null;
  if (clientId) {
    const account = await getAccount(clientId);
    if (!account) return err("Client account not found.");
    accountId = clientId;
    const viber = String(body.viber ?? "").trim();
    if (viber && viber !== account.viber) {
      await db.prepare("UPDATE account SET viber = ? WHERE id = ?").run(
        viber,
        clientId
      );
    }
  } else {
    const name = String(body.other_client_name ?? "").trim();
    const email = String(body.other_client_email ?? "").trim();
    if (!name) return err("Specify who this project is for (or pick a client).");
    if (!email) return err("Contact email is required for non-registered clients.");
  }

  const target = body.target_completed_at
    ? new Date(body.target_completed_at).toISOString()
    : null;

  try {
    const requestId = await createManualRequest({
      account_id: accountId,
      other_client_name: body.other_client_name?.trim(),
      other_client_email: body.other_client_email?.trim(),
      other_client_mobile: body.other_client_mobile?.trim(),
      other_client_viber: body.other_client_viber?.trim(),
      request_type_id: rt.id,
      title,
      brief_answers: body.brief ?? {},
      target_completed_at: target,
      phase_id: body.phase_id ? Number(body.phase_id) : null,
    });
    return ok({ ok: true, id: requestId });
  } catch (e) {
    return err((e as Error).message);
  }
}
