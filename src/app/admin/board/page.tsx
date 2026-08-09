import { requireAdmin } from "@/lib/guard";
import { getAdminBoard, getRequestTypes, listClientAccounts } from "@/lib/queries";
import { AdminBoardClient } from "./AdminBoardClient";

export const dynamic = "force-dynamic";

export default async function AdminBoardPage() {
  await requireAdmin();
  const rows = await getAdminBoard();
  const clients = await listClientAccounts();
  const requestTypes = await getRequestTypes();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Board</h1>
        <p className="mt-1 text-sm text-muted">
          Every client&apos;s queue in one place. Promote lineup cards to
          start work, keep internal statuses up to date, and upload
          deliverables to move cards to For Approval.
        </p>
      </div>
      <AdminBoardClient
        rows={rows}
        clients={clients}
        requestTypes={requestTypes.map((rt) => ({
          id: rt.id,
          slug: rt.slug,
          name: rt.name,
          brief_schema: rt.brief_schema,
        }))}
      />
    </div>
  );
}
