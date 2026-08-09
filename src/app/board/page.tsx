import { redirect } from "next/navigation";
import { requireClient } from "@/lib/guard";
import {
  getSubscriptionBundle,
  listRequests,
  getRequestTypes,
  getBrandProfile,
  getEntitlementUsage,
  requestTypeAvailableOn,
} from "@/lib/queries";
import { accessFor, graceDaysLeft } from "@/lib/state";
import { BoardClient } from "./BoardClient";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const s = await requireClient();
  const sub = await getSubscriptionBundle(s.account_id);

  if (!sub) redirect("/onboarding");
  const access = accessFor(sub);
  if (access.level === "none" || access.level === "waiting")
    redirect("/onboarding");

  const requests = await listRequests(s.account_id);
  const rawTypes = await getRequestTypes();
  const requestTypes = await Promise.all(
    rawTypes.map(async (rt) => {
      const avail = await requestTypeAvailableOn(rt, sub.plan, sub.addons);
      return {
        id: rt.id,
        slug: rt.slug,
        name: rt.name,
        slot_consuming: rt.slot_consuming,
        brief_schema: rt.brief_schema,
        sla_hours: rt.sla_hours,
        sort_order: rt.sort_order,
        available: avail.available,
        reason: avail.reason ?? null,
      };
    })
  );
  const brand = await getBrandProfile(s.account_id);
  const usage = await getEntitlementUsage(s.account_id);

  return (
    <BoardClient
      businessName={s.account?.business_name ?? ""}
      contactName={s.account?.contact_name ?? ""}
      subscription={sub}
      requests={requests}
      requestTypes={requestTypes}
      brand={brand}
      entitlementUsage={usage}
      accessLevel={access.level}
      accessReason={access.level === "readonly" ? access.reason : null}
      graceDaysLeft={
        sub.status === "expired" ? graceDaysLeft(sub) : null
      }
    />
  );
}
