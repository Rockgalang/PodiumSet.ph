import { requireAdmin } from "@/lib/guard";
import { getAccountSummaries } from "@/lib/queries";
import { SubscriptionsClient } from "./SubscriptionsClient";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  await requireAdmin();
  const summaries = await getAccountSummaries();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted">
          Manage client accounts — pause/resume, grant days, change plans, log
          entitlements, and record ad-management updates.
        </p>
      </div>
      <SubscriptionsClient summaries={summaries} />
    </div>
  );
}
