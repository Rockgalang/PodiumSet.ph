import Link from "next/link";
import { requireAdmin } from "@/lib/guard";
import {
  getDashboard,
  getMrr,
  getAccountSummaries,
  getRecentNotifications,
} from "@/lib/queries";
import { peso, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getDashboard();
  const mrr = await getMrr();
  const summaries = await getAccountSummaries();
  const notes = await getRecentNotifications(10) as Array<{
    id: number;
    to_email: string;
    subject: string;
    body: string;
    created_at: string;
  }>;

  const expiring = summaries
    .filter((s) => s.subscription.status === "expiring_soon")
    .sort((a, b) => a.subscription.days_remaining - b.subscription.days_remaining)
    .slice(0, 6);
  const pendingAccts = summaries
    .filter((s) => s.subscription.status === "pending_payment")
    .slice(0, 6);

  const cards = [
    {
      label: "Pending payments",
      value: String(stats.pending_payments),
      href: "/admin/payments",
      tone: stats.pending_payments > 0 ? "gold" : "dim",
    },
    {
      label: "Active subscriptions",
      value: String(stats.active_subs),
      href: "/admin/subscriptions",
      tone: "dim",
    },
    {
      label: "Expiring soon",
      value: String(stats.expiring),
      href: "/admin/subscriptions",
      tone: stats.expiring > 0 ? "amber" : "dim",
    },
    {
      label: "Ongoing requests",
      value: String(stats.ongoing),
      href: "/admin/board",
      tone: "dim",
    },
    {
      label: "For approval",
      value: String(stats.for_approval),
      href: "/admin/board",
      tone: stats.for_approval > 0 ? "gold" : "dim",
    },
    {
      label: "Overdue",
      value: String(stats.overdue),
      href: "/admin/board",
      tone: stats.overdue > 0 ? "rose" : "dim",
    },
    {
      label: "MRR",
      value: peso(mrr),
      href: "/admin/subscriptions",
      tone: "dim",
    },
    {
      label: "Pending subs",
      value: String(stats.pending_subs),
      href: "/admin/payments",
      tone: stats.pending_subs > 0 ? "gold" : "dim",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          At-a-glance operations. Payment verification lives in the Payments
          queue.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_14px_36px_-18px_rgba(0,0,0,0.85)]"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {c.label}
            </p>
            <p
              className={`mt-1.5 text-2xl font-bold ${
                c.tone === "gold"
                  ? "text-gold"
                  : c.tone === "amber"
                    ? "text-amber-300"
                    : c.tone === "rose"
                      ? "text-rose-300"
                      : "text-paper"
              }`}
            >
              {c.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-bold">Needs attention</h2>
          {expiring.length === 0 && pendingAccts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing needs attention.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {pendingAccts.map((a) => (
                <Link
                  key={a.account.id}
                  href="/admin/payments"
                  className="flex items-center justify-between rounded-xl bg-ink2 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{a.account.business_name}</span>
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
                    Awaiting payment
                  </span>
                </Link>
              ))}
              {expiring.map((a) => (
                <Link
                  key={a.account.id}
                  href="/admin/subscriptions"
                  className="flex items-center justify-between rounded-xl bg-ink2 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{a.account.business_name}</span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                    {a.subscription.days_remaining}d left
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-bold">Recent notifications</h2>
          <div className="mt-3 space-y-2.5">
            {notes.length === 0 && (
              <p className="text-sm text-muted">No notifications yet.</p>
            )}
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-xl bg-ink2 px-3 py-2.5 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-paper">{n.subject}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                {n.to_email && (
                  <p className="mt-0.5 text-xs text-muted">→ {n.to_email}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
