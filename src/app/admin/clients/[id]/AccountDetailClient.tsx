"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { peso, shortDate } from "@/lib/format";
import { errCls } from "@/components/form";
import { dueTag, DUE_TAG_LABEL } from "@/lib/workdays";
import type { AccountRow, PlanRow, AddonRow } from "@/lib/types";
import type { SubscriptionBundle } from "@/lib/session";

const COLUMN_LABEL: Record<string, string> = {
  lineup: "Lineup",
  ongoing: "Ongoing",
  for_approval: "For approval",
  done: "Done",
};

const COLUMN_STYLE: Record<string, string> = {
  lineup: "bg-surface2 text-muted",
  ongoing: "bg-gold/15 text-gold",
  for_approval: "bg-amber-500/15 text-amber-300",
  done: "bg-emerald-500/15 text-emerald-300",
};

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

const inputCls =
  "w-full rounded-xl border border-line bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-muted/70 focus:border-gold/70 focus:outline-none";

interface UnfinishedRequest {
  id: number;
  title: string;
  column: string;
  due_at: string | null;
  target_completed_at: string | null;
  created_at: string;
  type_name: string;
  phase_name: string | null;
}

interface DetailData {
  account: AccountRow;
  subscription: SubscriptionBundle | null;
  plans: PlanRow[];
  unfinished_requests: UnfinishedRequest[];
}

export function AccountDetailClient({
  account: initialAccount,
  subscription: initialSubscription,
  plans: initialPlans,
  unfinishedRequests: initialUnfinished,
}: {
  account: AccountRow;
  subscription: SubscriptionBundle | null;
  plans: PlanRow[];
  unfinishedRequests: UnfinishedRequest[];
}) {
  const [account, setAccount] = useState(initialAccount);
  const [subscription, setSubscription] = useState<SubscriptionBundle | null>(
    initialSubscription
  );
  const [plans, setPlans] = useState<PlanRow[]>(initialPlans);
  const [unfinished, setUnfinished] = useState<UnfinishedRequest[]>(
    initialUnfinished
  );
  const [edit, setEdit] = useState({
    business_name: initialAccount.business_name,
    contact_name: initialAccount.contact_name,
    email: initialAccount.email,
    mobile: initialAccount.mobile,
    viber: initialAccount.viber,
    city: initialAccount.city ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [addDays, setAddDays] = useState(7);
  const [planId, setPlanId] = useState<number>(
    initialSubscription?.plan_id ?? 0
  );

  async function refresh() {
    const d = await api<DetailData>(`/api/admin/accounts/${account.id}`);
    setAccount(d.account);
    setSubscription(d.subscription);
    setPlans(d.plans);
    setUnfinished(d.unfinished_requests ?? []);
    setEdit({
      business_name: d.account.business_name,
      contact_name: d.account.contact_name,
      email: d.account.email,
      mobile: d.account.mobile,
      viber: d.account.viber,
      city: d.account.city ?? "",
    });
    setPlanId(d.subscription?.plan_id ?? 0);
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await fn();
      setSaved(true);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAccount() {
    const body = {
      business_name: edit.business_name.trim(),
      contact_name: edit.contact_name.trim(),
      email: edit.email.trim(),
      mobile: edit.mobile.trim(),
      viber: edit.viber.trim(),
      city: edit.city.trim(),
    };
    if (!body.business_name || !body.email)
      throw new Error("Business name and email are required.");
    await run(async () => {
      await api(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        json: body,
      });
    });
  }

  async function act(action: string, payload: Record<string, unknown> = {}) {
    await run(async () => {
      await api(`/api/admin/subscriptions/${account.id}/actions`, {
        method: "POST",
        json: { action, ...payload },
      });
    });
  }

  const status = subscription?.status ?? "none";
  const planName = subscription?.plan?.name ?? "No plan";
  const addons = subscription?.addons ?? ([] as AddonRow[]);
  const canPause = status === "active" || status === "expiring_soon";
  const canResume = status === "paused";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clients" className="text-sm text-muted hover:text-gold">
          ← Back to clients
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{account.business_name}</h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                STATUS_STYLE[status] ?? "bg-surface2 text-muted"
              }`}
            >
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {account.contact_name} · {account.email}
            {account.mobile ? ` · ${account.mobile}` : ""}
            {account.viber ? ` · Viber ${account.viber}` : ""}
            {account.city ? ` · ${account.city}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">
            {planName} · {subscription?.days_remaining ?? 0} days remaining
            {addons.length > 0
              ? ` · addons: ${addons.map((a) => a.name).join(", ")}`
              : ""}
          </p>
        </div>
        <Link
          href={`/admin/clients/${account.id}/dashboard`}
          className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gold-strong"
        >
          Open dashboard →
        </Link>
      </div>

      {error && <div className={errCls}>{error}</div>}
      {saved && !error && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          Saved.
        </div>
      )}

      <section className="rounded-2xl border border-line bg-ink2 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Unfinished requests ({unfinished.length})
          </h3>
          <Link
            href={`/admin/clients/${account.id}/dashboard`}
            className="text-xs font-semibold text-gold hover:underline"
          >
            Manage on dashboard →
          </Link>
        </div>
        {unfinished.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            All requests are done — no unfinished work.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {unfinished.map((r) => {
              const tag = dueTag(r.target_completed_at);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-paper">
                      {r.title}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {r.type_name}
                      {r.phase_name ? ` · ${r.phase_name}` : ""} · added{" "}
                      {shortDate(r.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {tag && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          tag === "overdue"
                            ? "bg-rose-500/15 text-rose-300"
                            : tag === "due_today"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-sky-500/15 text-sky-300"
                        }`}
                      >
                        {DUE_TAG_LABEL[tag]}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        COLUMN_STYLE[r.column] ?? "bg-surface2 text-muted"
                      }`}
                    >
                      {COLUMN_LABEL[r.column] ?? r.column}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-ink2 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Account details
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">
                Business name
              </span>
              <input
                value={edit.business_name}
                onChange={(e) => setEdit({ ...edit, business_name: e.target.value })}
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">
                  Contact name
                </span>
                <input
                  value={edit.contact_name}
                  onChange={(e) => setEdit({ ...edit, contact_name: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Email</span>
                <input
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  className={inputCls}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Mobile</span>
                <input
                  value={edit.mobile}
                  onChange={(e) => setEdit({ ...edit, mobile: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Viber</span>
                <input
                  value={edit.viber}
                  onChange={(e) => setEdit({ ...edit, viber: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">City / address</span>
                <input
                  value={edit.city}
                  onChange={(e) => setEdit({ ...edit, city: e.target.value })}
                  className={inputCls}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveAccount}
                disabled={busy}
                className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
              >
                Save details
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-ink2 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Subscription actions
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canPause ? (
              <button
                onClick={() => act("pause")}
                disabled={busy}
                className="rounded-lg border border-line2 px-3 py-2 text-xs font-semibold text-paper hover:border-gold/60 disabled:opacity-50"
              >
                Pause
              </button>
            ) : null}
            {canResume ? (
              <button
                onClick={() => act("resume")}
                disabled={busy}
                className="rounded-lg border border-line2 px-3 py-2 text-xs font-semibold text-paper hover:border-gold/60 disabled:opacity-50"
              >
                Resume
              </button>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={addDays}
                onChange={(e) => setAddDays(Number(e.target.value))}
                className={inputCls + " w-24"}
              />
              <button
                onClick={() => act("add_days", { days: addDays })}
                disabled={busy}
                className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
              >
                Grant days
              </button>
            </div>
          </div>

          <h4 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">
            Change plan
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={planId}
              onChange={(e) => setPlanId(Number(e.target.value))}
              className={inputCls + " max-w-xs"}
            >
              <option value={0}>No plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {peso(p.price_php)}
                </option>
              ))}
            </select>
            <button
              onClick={() => planId && act("apply_plan_now", { plan_id: planId })}
              disabled={busy || !planId}
              className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
            >
              Apply now
            </button>
            <button
              onClick={() => planId && act("change_plan", { plan_id: planId })}
              disabled={busy || !planId}
              className="rounded-lg border border-line2 px-3 py-2 text-xs font-semibold text-paper hover:border-gold/60 disabled:opacity-50"
            >
              Queue for next cycle
            </button>
          </div>
          {subscription?.next_plan_id ? (
            <p className="mt-2 text-xs text-muted">
              Queued: plan change pending for next cycle.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
