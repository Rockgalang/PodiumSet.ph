import { requireAdmin } from "@/lib/guard";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await requireAdmin();
  return (
    <div className="min-h-screen">
      <AdminNav businessName={s.account?.business_name ?? ""} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
