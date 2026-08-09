import { requireAdmin } from "@/lib/guard";
import { getPendingPayments } from "@/lib/queries";
import { PaymentsClient } from "./PaymentsClient";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const payments = await getPendingPayments();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="mt-1 text-sm text-muted">
          {payments.length === 0
            ? "No payments awaiting verification."
            : `${payments.length} payment${payments.length === 1 ? "" : "s"} awaiting verification.`}
        </p>
      </div>
      <PaymentsClient payments={payments} />
    </div>
  );
}
