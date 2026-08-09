import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/guard";
import { getAccount, listPhases, getRequestTypes } from "@/lib/queries";
import { ClientDashboardClient } from "./ClientDashboardClient";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const accountId = Number(id);
  const account = await getAccount(accountId);
  if (!account) return notFound();

  const phases = (await listPhases(accountId)).map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/admin/clients/${accountId}`}
            className="text-sm text-muted hover:text-gold"
          >
            ← Back to {account.business_name}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {account.business_name} · Dashboard
          </h1>
          <p className="text-sm text-muted">
            Full-control kanban: add, drag between Lineup / Ongoing / For
            Approval / Done, edit, break down into tasks, and delete projects.
          </p>
        </div>
      </div>
      <ClientDashboardClient
        accountId={accountId}
        requestTypes={(await getRequestTypes()).map((rt) => ({
          id: rt.id,
          name: rt.name,
          slug: rt.slug,
        }))}
        initialPhases={phases}
      />
    </div>
  );
}