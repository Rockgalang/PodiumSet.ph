import Link from "next/link";
import { requireAdmin } from "@/lib/guard";
import { getAccountSummaries } from "@/lib/queries";
import type { AccountSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  expiring_soon: "bg-amber-500/15 text-amber-300",
  paused: "bg-surface2 text-paper2",
  pending_payment: "bg-gold/15 text-gold",
  rejected: "bg-rose-500/15 text-rose-300",
  expired: "bg-rose-500/15 text-rose-300",
  draft: "bg-surface2 text-muted",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  expiring_soon: "Expiring soon",
  paused: "Paused",
  pending_payment: "Pending payment",
  rejected: "Rejected",
  expired: "Expired",
  draft: "Draft",
};

const STATUS_PRIORITY: Record<string, number> = {
  pending_payment: 0,
  expiring_soon: 1,
  active: 2,
  paused: 3,
  rejected: 4,
  expired: 5,
  draft: 6,
};

export default async function AdminClientsPage() {
  await requireAdmin();
  const summaries = await getAccountSummaries();

  const groups = new Map<string, AccountSummary[]>();
  for (const s of summaries) {
    const key = s.subscription.plan_name ?? "No plan";
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => {
    if (a[0] === "No plan") return 1;
    if (b[0] === "No plan") return -1;
    return a[0].localeCompare(b[0]);
  });

  const total = summaries.length;
  const active = summaries.filter(
    (s) => s.subscription.status === "active" || s.subscription.status === "expiring_soon"
  ).length;
  const expired = summaries.filter(
    (s) => s.subscription.status === "expired" || s.subscription.status === "rejected"
  ).length;
  const pending = summaries.filter(
    (s) => s.subscription.status === "pending_payment"
  ).length;
  const paused = summaries.filter(
    (s) => s.subscription.status === "paused"
  ).length;

  const statCard = (label: string, n: number, cls: string) => (
    <div className="rounded-2xl border border-line bg-ink2/60 p-4">
      <p className={`text-2xl font-bold ${cls}`}>{n}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="mt-1 text-sm text-muted">
          All client accounts, organised by package. Click a client to manage
          their account or open their dashboard.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statCard("Total clients", total, "text-paper")}
        {statCard("Active", active, "text-emerald-300")}
        {statCard("Expiring soon", summaries.filter((s) => s.subscription.status === "expiring_soon").length, "text-amber-300")}
        {statCard("Pending payment", pending, "text-gold")}
        {statCard("Expired", expired, "text-rose-300")}
      </div>

      {sortedGroups.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          No clients yet.
        </p>
      )}

      {sortedGroups.map(([planName, list]) => {
        const sorted = [...list].sort(
          (a, b) =>
            (STATUS_PRIORITY[a.subscription.status] ?? 9) -
              (STATUS_PRIORITY[b.subscription.status] ?? 9) ||
            a.account.created_at.localeCompare(b.account.created_at)
        );
        return (
          <section
            key={planName}
            className="overflow-hidden rounded-2xl border border-line bg-ink2/60"
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                {planName}
              </h2>
              <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                {list.length} client{list.length === 1 ? "" : "s"}
              </span>
            </header>
            <ul className="divide-y divide-line">
              {sorted.map((s) => (
                <li key={s.account.id}>
                  <Link
                    href={`/admin/clients/${s.account.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-ink2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-paper">
                        {s.account.business_name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {s.account.contact_name} · {s.account.email}
                        {s.account.viber
                          ? ` · Viber ${s.account.viber}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_STYLE[s.subscription.status] ?? "bg-surface2 text-muted"
                        }`}
                      >
                        {STATUS_LABEL[s.subscription.status] ??
                          s.subscription.status}
                      </span>
                      <span className="text-xs text-muted">
                        {s.subscription.days_remaining} days
                      </span>
                      {s.pending_payments > 0 && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">
                          {s.pending_payments} pending
                        </span>
                      )}
                      {s.unfinished_requests > 0 && (
                        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
                          {s.unfinished_requests} unfinished
                        </span>
                      )}
                      {s.active_requests > 0 && (
                        <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                          {s.active_requests} active
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
