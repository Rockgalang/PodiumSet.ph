"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { peso, shortDate, timeAgo, fullDate } from "@/lib/format";
import { inputCls, errCls } from "@/components/form";

/* ---------------- types ---------------- */

interface AccountLite {
  id: number;
  business_name: string;
  contact_name: string;
  email: string;
  mobile: string;
  viber: string;
  industry: string | null;
  created_at: string;
}

interface Summary {
  account: AccountLite;
  subscription: {
    id: number;
    status: string;
    days_remaining: number;
    last_ticked_on: string | null;
    plan_name: string | null;
    plan_price_php: number | null;
    next_plan_name: string | null;
    started_at: string;
  };
  pending_payments: number;
  active_requests: number;
  last_payment_at: string | null;
}

interface PlanLite {
  id: number;
  name: string;
  price_php: number;
  active_slots: number;
  consult_hours: number;
  shoot_hours: number;
  includes_ads: number;
}

interface PaymentLite {
  id: number;
  amount_php: number;
  method: string;
  status: string;
  reference_no: string | null;
  proof_url: string | null;
  rejection_reason: string | null;
  days_granted: number;
  created_at: string;
}

interface EntLog {
  id: number;
  kind: string;
  amount: number;
  note: string;
  logged_at: string;
  billing_month: string;
}

interface AdUpdate {
  id: number;
  month: string;
  summary: string;
  notes: string;
  created_at: string;
}

interface AccountDetail {
  account: AccountLite;
  subscription: {
    id: number;
    account_id: number;
    plan_id: number | null;
    next_plan_id: number | null;
    status: string;
    days_remaining: number;
    started_at: string;
    paused_at: string | null;
    expired_at: string | null;
    grace_until: string | null;
    plan: PlanLite | null;
    addons: Array<{ id: number; name: string }>;
  } | null;
  payments: PaymentLite[];
  entitlement_usage: Record<string, number>;
  entitlement_logs: EntLog[];
  ad_updates: AdUpdate[];
  plans: PlanLite[];
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  expiring_soon: "bg-amber-500/15 text-amber-300",
  paused: "bg-surface2 text-paper2",
  pending_payment: "bg-gold/15 text-gold",
  rejected: "bg-rose-500/15 text-rose-300",
  expired: "bg-rose-500/15 text-rose-300",
  draft: "bg-surface2 text-muted",
};

export function SubscriptionsClient({ summaries }: { summaries: Summary[] }) {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  const filtered = summaries.filter((s) =>
    `${s.account.business_name} ${s.account.email} ${s.account.contact_name}`
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  async function open(accountId: number) {
    setSelectedId(accountId);
    setDetail(null);
    setErr("");
    setLoading(true);
    try {
      const d = await api<AccountDetail>(`/api/admin/accounts/${accountId}`);
      setDetail(d);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function act(action: string, payload: Record<string, unknown> = {}) {
    if (!selectedId) return;
    setErr("");
    try {
      await api(`/api/admin/subscriptions/${selectedId}/actions`, {
        method: "POST",
        json: { action, ...payload },
      });
      await open(selectedId);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* List */}
      <div className="rounded-2xl border border-line bg-surface p-3">
        <input
          className={inputCls}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients…"
        />
        <div className="mt-3 max-h-[70vh] space-y-1.5 overflow-y-auto pr-1 board-scroll">
          {filtered.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted">
              No matches.
            </p>
          )}
          {filtered.map((s) => (
            <button
              key={s.account.id}
              onClick={() => open(s.account.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                selectedId === s.account.id
                  ? "bg-ink2"
                  : "hover:bg-ink2/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">
                  {s.account.business_name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    STATUS_STYLE[s.subscription.status] ?? "bg-surface2 text-muted"
                  }`}
                >
                  {s.subscription.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-xs text-muted">
                <span className="truncate">{s.subscription.plan_name ?? "No plan"}</span>
                <span>{s.subscription.days_remaining}d</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        {err && <div className={errCls}>{err}</div>}
        {!selectedId && (
          <p className="py-16 text-center text-sm text-muted">
            Select a client to manage their subscription.
          </p>
        )}
        {loading && (
          <p className="py-16 text-center text-sm text-muted">Loading…</p>
        )}
        {detail && !loading && (
          <DetailPanel detail={detail} onAction={act} />
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  detail,
  onAction,
}: {
  detail: AccountDetail;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const router = useRouter();
  const [days, setDays] = useState("30");
  const [planId, setPlanId] = useState<string>(
    String(detail.subscription?.plan_id ?? "")
  );
  const [entKind, setEntKind] = useState("consult_hours");
  const [entAmount, setEntAmount] = useState("");
  const [entNote, setEntNote] = useState("");
  const [adsMonth, setAdsMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [adsSummary, setAdsSummary] = useState("");
  const [adsNotes, setAdsNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sub = detail.subscription;
  const status = sub?.status ?? "none";
  const canPause = status === "active" || status === "expiring_soon";

  async function run(fn: () => Promise<void>) {
    setErr("");
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ENT_KINDS = [
    { key: "consult_hours", label: "Consultancy (hrs)" },
    { key: "shoot_hours", label: "Shoot (hrs)" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{detail.account.business_name}</h2>
          <p className="text-sm text-muted">
            {detail.account.contact_name} · {detail.account.email}
            {detail.account.mobile ? ` · ${detail.account.mobile}` : ""}
            {detail.account.viber ? ` · Viber ${detail.account.viber}` : ""}
          </p>
          <a
            href={`/admin/clients/${detail.account.id}/dashboard`}
            className="mt-2 inline-block rounded-lg border border-line bg-ink2 px-3 py-1.5 text-xs font-semibold text-paper hover:border-gold/60"
          >
            Open client dashboard →
          </a>
        </div>
        <div className="text-right">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              STATUS_STYLE[status] ?? "bg-surface2 text-muted"
            }`}
          >
            {status}
          </span>
          <p className="mt-1 text-xs text-muted">
            {sub?.plan?.name ?? "No plan"} · {sub?.days_remaining ?? 0} days
            {sub?.next_plan_id ? " · next cycle change queued" : ""}
          </p>
        </div>
      </div>

      {err && <div className={errCls}>{err}</div>}

      {/* Actions */}
      <section className="rounded-xl border border-line bg-ink2 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          Subscription actions
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canPause ? (
            <button
              onClick={() => run(() => onAction("pause"))}
              disabled={busy}
              className="rounded-lg border border-line2 px-3 py-2 text-xs font-semibold text-paper hover:border-gold/60 disabled:opacity-50"
            >
              Pause
            </button>
          ) : (
            status === "paused" && (
              <button
                onClick={() => run(() => onAction("resume"))}
                disabled={busy}
                className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
              >
                Resume
              </button>
            )
          )}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-20 rounded-lg border border-line bg-surface px-2 py-2 text-xs text-paper"
            />
            <button
              onClick={() => run(() => onAction("add_days", { days: Number(days) }))}
              disabled={busy}
              className="rounded-lg border border-line2 px-3 py-2 text-xs font-semibold text-paper hover:border-gold/60 disabled:opacity-50"
            >
              + Add days
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-2 text-xs text-paper"
            >
              <option value="">— change plan —</option>
              {detail.plans.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} ({peso(p.price_php)})
                </option>
              ))}
            </select>
            {planId && (
              <>
                <button
                  onClick={() => run(() => onAction("change_plan", { plan_id: Number(planId) }))}
                  disabled={busy}
                  className="rounded-lg border border-line2 px-3 py-2 text-xs font-semibold text-paper hover:border-gold/60 disabled:opacity-50"
                >
                  Queue for renewal
                </button>
                <button
                  onClick={() => run(() => onAction("apply_plan_now", { plan_id: Number(planId) }))}
                  disabled={busy}
                  className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                >
                  Apply now
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Entitlements */}
      <section className="rounded-xl border border-line bg-ink2 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Entitlements
          </h3>
          <span className="text-xs text-muted">
            Used:{" "}
            {ENT_KINDS.map((k) => `${k.key.split("_")[0]} ${detail.entitlement_usage[k.key] ?? 0}`).join(" · ") ||
              "0"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <select
            value={entKind}
            onChange={(e) => setEntKind(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-2 text-xs text-paper"
          >
            {ENT_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.5"
            value={entAmount}
            onChange={(e) => setEntAmount(e.target.value)}
            placeholder="amount"
            className="w-24 rounded-lg border border-line bg-surface px-2 py-2 text-xs text-paper"
          />
          <input
            value={entNote}
            onChange={(e) => setEntNote(e.target.value)}
            placeholder="note (optional)"
            className="w-44 rounded-lg border border-line bg-surface px-2 py-2 text-xs text-paper"
          />
          <button
            onClick={() =>
              run(async () => {
                await api("/api/admin/entitlements", {
                  method: "POST",
                  json: {
                    account_id: detail.account.id,
                    kind: entKind,
                    amount: Number(entAmount),
                    note: entNote,
                  },
                });
                setEntAmount("");
                setEntNote("");
              })
            }
            disabled={busy || !entAmount}
            className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            Log usage
          </button>
        </div>
        {detail.entitlement_logs.length > 0 && (
          <div className="mt-3 space-y-1">
            {detail.entitlement_logs.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center justify-between text-xs text-muted">
                <span>
                  {l.kind} · {l.amount} · {l.billing_month}
                  {l.note ? ` — ${l.note}` : ""}
                </span>
                <span>{shortDate(l.logged_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ads management */}
      {sub?.plan?.includes_ads === 1 && (
        <section className="rounded-xl border border-line bg-ink2 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Ad management updates
          </h3>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <input
              type="month"
              value={adsMonth}
              onChange={(e) => setAdsMonth(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-2 text-xs text-paper"
            />
            <input
              value={adsSummary}
              onChange={(e) => setAdsSummary(e.target.value)}
              placeholder="monthly summary"
              className="w-48 rounded-lg border border-line bg-surface px-2 py-2 text-xs text-paper"
            />
            <input
              value={adsNotes}
              onChange={(e) => setAdsNotes(e.target.value)}
              placeholder="notes (optional)"
              className="w-40 rounded-lg border border-line bg-surface px-2 py-2 text-xs text-paper"
            />
            <button
              onClick={() =>
                run(async () => {
                  await api("/api/admin/ads", {
                    method: "POST",
                    json: {
                      subscription_id: sub!.id,
                      month: adsMonth,
                      summary: adsSummary,
                      notes: adsNotes,
                    },
                  });
                  setAdsSummary("");
                  setAdsNotes("");
                })
              }
              disabled={busy || !sub || !adsSummary.trim()}
              className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
            >
              Add update
            </button>
          </div>
          {detail.ad_updates.length > 0 && (
            <div className="mt-3 space-y-2">
              {detail.ad_updates.map((u) => (
                <div key={u.id} className="rounded-lg border border-line bg-surface px-3 py-2 text-xs">
                  <p className="font-semibold text-paper">
                    {u.month}
                    <span className="ml-2 font-normal text-muted">
                      {timeAgo(u.created_at)}
                    </span>
                  </p>
                  {u.summary && <p className="mt-0.5 text-muted">{u.summary}</p>}
                  {u.notes && <p className="mt-0.5 text-muted/70">{u.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Payment history */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          Payment history
        </h3>
        <div className="mt-2 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-ink2 text-left text-xs text-muted">
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Method</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-muted">
                    No payments yet.
                  </td>
                </tr>
              )}
              {detail.payments.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-muted">{fullDate(p.created_at)}</td>
                  <td className="px-3 py-2 font-semibold">{peso(p.amount_php)}</td>
                  <td className="px-3 py-2 text-muted">{p.method}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        STATUS_STYLE[p.status] ?? "bg-surface2 text-muted"
                      }`}
                    >
                      {p.status}
                      {p.rejection_reason ? ` — ${p.rejection_reason}` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
