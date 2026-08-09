import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guard";
import { getAccount, getPlans, listUnfinishedRequests } from "@/lib/queries";
import { getSubscriptionBundle } from "@/lib/session";
import { AccountDetailClient } from "./AccountDetailClient";

export const dynamic = "force-dynamic";

export default async function ClientAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const accountId = Number(id);
  const account = await getAccount(accountId);
  if (!account) return notFound();

  const subscription = await getSubscriptionBundle(accountId);
  const plans = await getPlans();
  const unfinishedRequests = await listUnfinishedRequests(accountId);

  return (
    <div className="space-y-6">
      <AccountDetailClient
        account={account}
        subscription={subscription}
        plans={plans}
        unfinishedRequests={unfinishedRequests}
      />
    </div>
  );
}
