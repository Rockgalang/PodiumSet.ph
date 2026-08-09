import { redirect } from "next/navigation";
import { requireClient } from "@/lib/guard";
import {
  getPlans,
  getAddons,
  getSubscriptionBundle,
  getBrandProfile,
  getPaymentsForAccount,
  addonsForSubscription,
} from "@/lib/queries";
import { Onboarding } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const s = await requireClient();
  const sub = await getSubscriptionBundle(s.account_id);

  if (sub && ["active", "expiring_soon", "paused"].includes(sub.status))
    redirect("/board");

  const plans = await getPlans();
  const addons = await getAddons();
  const brand = await getBrandProfile(s.account_id);
  const payments = await getPaymentsForAccount(s.account_id);
  const latest = payments[0];

  return (
    <Onboarding
      plans={plans}
      addons={addons}
      brand={brand}
      subscriptionStatus={sub?.status ?? "draft"}
      initialPlanId={sub?.plan_id ?? null}
      initialAddonIds={sub ? (await addonsForSubscription(sub.id)).map((a) => a.id) : []}
      latestPayment={
        latest
          ? {
              id: latest.id,
              status: latest.status,
              amount_php: latest.amount_php,
              method: latest.method,
              reference_no: latest.reference_no,
              proof_url: latest.proof_url,
              created_at: latest.created_at,
              rejection_reason: latest.rejection_reason,
            }
          : null
      }
    />
  );
}
