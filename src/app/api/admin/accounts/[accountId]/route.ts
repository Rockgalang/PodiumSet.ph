import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import {
  getAccount,
  getSubscriptionBundle,
  getPaymentsForAccount,
  getEntitlementUsage,
  getEntitlementLogs,
  listAdUpdates,
  listUnfinishedRequests,
  getPlans,
} from "@/lib/queries";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { accountId } = await params;
  const id = Number(accountId);

  const account = await getAccount(id);
  if (!account) return err("Account not found", 404);

  const subscription = await getSubscriptionBundle(id);
  const payments = await getPaymentsForAccount(id);
  const usage = await getEntitlementUsage(id);
  const logs = await getEntitlementLogs(id);
  const adUpdates = await listAdUpdates(subscription?.id ?? -1);

  return ok({
    account,
    subscription,
    payments,
    entitlement_usage: usage,
    entitlement_logs: logs,
    ad_updates: adUpdates,
    unfinished_requests: await listUnfinishedRequests(id),
    plans: await getPlans(),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { accountId } = await params;
  const id = Number(accountId);

  const account = await getAccount(id);
  if (!account) return err("Account not found", 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const businessName = String(body.business_name ?? account.business_name).trim();
  const contactName = String(body.contact_name ?? account.contact_name).trim();
  const email = String(body.email ?? account.email).trim();
  const mobile = String(body.mobile ?? account.mobile).trim();
  const viber = String(body.viber ?? account.viber).trim();
  const city = String(body.city ?? account.city ?? "").trim();
  if (!businessName) return err("Business name is required.");
  if (!email || !email.includes("@")) return err("A valid email is required.");

  await db.prepare(
    "UPDATE account SET business_name = ?, contact_name = ?, email = ?, mobile = ?, viber = ?, city = ? WHERE id = ?"
  ).run(businessName, contactName, email, mobile, viber, city, id);

  return ok({ ok: true });
}
