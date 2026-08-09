"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/compress";
import { peso, shortDate, fullDate, timeAgo, initials } from "@/lib/format";
import { autoApproveDate, dueStatus, COLUMNS } from "@/lib/state";
import { dueTag } from "@/lib/workdays";
import { inputCls, labelCls, primaryBtn, errCls } from "@/components/form";
import { aiSourceFor } from "@/lib/ai-source";
import { Logo } from "@/components/Logo";
import type { Column } from "@/lib/types";

/* ------------------------- local types ------------------------- */

interface PlanLite {
  id: number;
  name: string;
  price_php: number;
  active_slots: number;
  includes_video: number;
  consult_hours: number;
  shoot_hours: number;
  includes_ads: number;
  priority_queue: number;
  featured: number;
  tagline: string;
  description: string;
  sort_order: number;
}

interface AddonLite {
  id: number;
  name: string;
  price_php: number;
  bundled_price_php: number;
  requires_plan: number;
  allowed_plans: string;
  description: string;
}

interface SubscriptionLite {
  id: number;
  account_id: number;
  plan_id: number | null;
  next_plan_id: number | null;
  status: string;
  days_remaining: number;
  last_ticked_on: string | null;
  started_at: string;
  paused_at: string | null;
  expired_at: string | null;
  grace_until: string | null;
  created_at: string;
  plan: PlanLite | null;
  addons: AddonLite[];
}

interface RequestLite {
  id: number;
  request_type_id: number;
  title: string;
  brief_answers: string;
  column: Column;
  internal_status: string | null;
  position: number;
  phase_id: number | null;
  phase_name: string | null;
  revision_count: number;
  due_at: string | null;
  target_completed_at: string | null;
  approval_since: string | null;
  last_approval_reminder_at: string | null;
  auto_approved: number;
  created_at: string;
  updated_at: string;
  type_name: string;
  type_slug: string;
  slot_consuming: number;
  sla_hours: number;
  latest_deliverable: string | null;
  latest_deliverable_at: string | null;
  comment_count: number;
}

interface BriefField {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "url"
    | "select"
    | "date"
    | "number"
    | "links"
    | "file";
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface RequestTypeLite {
  id: number;
  slug: string;
  name: string;
  slot_consuming: number;
  brief_schema: BriefField[];
  sla_hours: number;
  sort_order: number;
  available: boolean;
  reason: string | null;
}

interface BrandLite {
  id: number;
  account_id: number;
  logo_urls: string;
  colors: string;
  fonts: string;
  tone: string;
  links: string;
  avoid_notes: string;
  updated_at: string;
}

interface DetailComment {
  id: number;
  body: string;
  created_at: string;
  author_email: string;
  author_role: string;
  author_account_id: number;
  internal_only: number;
}

interface DetailAttachment {
  url: string;
  created_at: string;
}

interface Deliverable {
  id: number;
  request_id: number;
  version: number;
  file_url: string;
  uploaded_at: string;
  approval_state: string;
}

interface RequestDetail {
  id: number;
  title: string;
  column: Column;
  internal_status: string | null;
  revision_count: number;
  due_at: string | null;
  target_completed_at: string | null;
  approval_since: string | null;
  auto_approved: number;
  created_at: string;
  updated_at: string;
  type_name: string;
  type_slug: string;
  sla_hours: number;
  brief_schema: BriefField[];
  brief_answers: Record<string, unknown>;
  deliverables: Deliverable[];
  comments: DetailComment[];
  attachments: DetailAttachment[];
}

interface Props {
  businessName: string;
  contactName: string;
  subscription: SubscriptionLite;
  requests: RequestLite[];
  requestTypes: RequestTypeLite[];
  brand: BrandLite | null;
  entitlementUsage: Record<string, number>;
  accessLevel: string;
  accessReason: string | null;
  graceDaysLeft: number | null;
}

const CLIENT_STATUS: Record<string, string> = {
  in_progress: "In progress",
  blocked_assets: "Waiting on you — assets needed",
  awaiting_partner: "Awaiting partner",
  qa: "Internal QA",
};

function isImage(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(url);
}

/* ================================================================== */

export function BoardClient({
  businessName,
  contactName,
  subscription,
  requests,
  requestTypes,
  brand,
  entitlementUsage,
  accessLevel,
  accessReason,
  graceDaysLeft,
}: Props) {
  const router = useRouter();
  const readonly = accessLevel === "readonly";

  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [showBrand, setShowBrand] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const plan = subscription.plan;
  const hasAiCreative = subscription.addons.some(
    (a) => a.name.toLowerCase().replace(/[^a-z0-9]/g, "") === "aicreative"
  );
  const slotsUsed = requests.filter((r) =>
    ["ongoing", "for_approval"].includes(r.column)
  ).length;
  const freeSlots = Math.max(0, (plan?.active_slots ?? 0) - slotsUsed);

  const byColumn = useMemo(() => {
    const map: Record<Column, RequestLite[]> = {
      lineup: [],
      ongoing: [],
      for_approval: [],
      done: [],
    };
    for (const r of requests) map[r.column].push(r);
    map.lineup.sort((a, b) => a.position - b.position);
    map.done.sort(
      (a, b) => (a.updated_at < b.updated_at ? 1 : -1)
    );
    return map;
  }, [requests]);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  function statusPill() {
    const s = subscription.status;
    const pill =
      s === "active" || s === "expiring_soon"
        ? "border-gold/40 bg-gold-soft/40 text-gold"
        : s === "paused"
          ? "border-line2 bg-surface2 text-paper2"
          : "border-line2 bg-surface2 text-muted";
    return (
      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${pill}`}>
        {s === "expiring_soon"
          ? `${subscription.days_remaining} days left`
          : s === "active"
            ? "Active"
            : s === "paused"
              ? "Paused"
              : "Grace period"}
      </span>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden text-sm text-muted sm:inline">
              {businessName}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {statusPill()}
            {!readonly && (
              <button
                onClick={() => setShowNew(true)}
                className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gold-strong"
              >
                + New request
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-sm font-bold text-gold"
              >
                {initials(businessName || contactName || "You")}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 z-40 w-44 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowBrand(true);
                    }}
                    className="block w-full px-4 py-3 text-left text-sm hover:bg-ink2"
                  >
                    Edit brand profile
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                    className="block w-full px-4 py-3 text-left text-sm text-rose-300 hover:bg-ink2"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Access banner */}
      {readonly && (
        <div className="border-b border-amber-500/20 bg-amber-500/10">
          <div className="mx-auto max-w-7xl px-4 py-3 text-sm text-amber-200 sm:px-6">
            {accessReason === "paused" ? (
              <>
                Your subscription is paused. Your board is read-only — download
                any deliverables anytime. Your remaining days are frozen.
              </>
            ) : (
              <>
                Your subscription has ended. Read-only download window with{" "}
                <strong>{graceDaysLeft} days left</strong>. Renew anytime to keep
                your queue.
              </>
            )}
          </div>
        </div>
      )}

      {/* Plan strip */}
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {plan?.name ?? "No plan yet"} · {peso(plan?.price_php ?? 0)}/mo
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {plan?.tagline ?? "Set up your subscription to get started."}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="font-semibold text-paper">
                {slotsUsed}/{plan?.active_slots ?? 0}
              </span>{" "}
              <span className="text-muted">slots in use</span>
            </div>
            {plan && plan.consult_hours > 0 && (
              <div className="text-muted">
                Consult{" "}
                <span className="font-semibold text-paper">
                  {(entitlementUsage.consult_hours ?? 0)}/
                  {plan.consult_hours}h
                </span>
              </div>
            )}
            {plan && plan.shoot_hours > 0 && (
              <div className="text-muted">
                Shoot{" "}
                <span className="font-semibold text-paper">
                  {(entitlementUsage.shoot_hours ?? 0)}/{plan.shoot_hours}h
                </span>
              </div>
            )}
            {subscription.addons.length > 0 && (
              <span className="hidden rounded-full border border-line px-2.5 py-1 text-xs text-muted sm:inline">
                {subscription.addons.map((a) => a.name).join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Slot meter */}
      {plan && plan.active_slots > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className={`h-full rounded-full ${
                freeSlots === 0 ? "bg-rose-500" : "bg-gold"
              }`}
              style={{
                width: `${Math.min(100, (slotsUsed / plan.active_slots) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {freeSlots === 0
              ? "All slots in use — finish or approve something to free a slot."
              : `${freeSlots} free slot${freeSlots === 1 ? "" : "s"} — new requests queue up until a slot opens.`}
          </p>
        </div>
      )}

      {/* Board columns */}
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.key}
              colKey={col.key}
              label={col.clientLabel}
              cards={byColumn[col.key]}
              readonly={readonly}
              onOpen={setDetailId}
              onMove={async (id, dir) => {
                const ids = byColumn.lineup.map((r) => r.id);
                const i = ids.indexOf(id);
                const j = dir === "up" ? i - 1 : i + 1;
                if (i < 0 || j < 0 || j >= ids.length) return;
                [ids[i], ids[j]] = [ids[j], ids[i]];
                await api("/api/board/requests/reorder", {
                  method: "POST",
                  json: { ids },
                });
                router.refresh();
              }}
            />
          ))}
        </div>
      </main>

      {showNew && (
        <NewRequestModal
          requestTypes={requestTypes}
          hasAiCreative={hasAiCreative}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {detailId !== null && (
        <DetailModal
          requestId={detailId}
          accountId={subscription.account_id}
          readonly={readonly}
          onClose={() => setDetailId(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {showBrand && (
        <BrandModal
          brand={brand}
          onClose={() => setShowBrand(false)}
          onSaved={() => {
            setShowBrand(false);
            router.refresh();
          }}
        />
      )}

      {menuOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

/* ============================ Column ============================ */

function Column({
  colKey,
  label,
  cards,
  readonly,
  onOpen,
  onMove,
}: {
  colKey: Column;
  label: string;
  cards: RequestLite[];
  readonly: boolean;
  onOpen: (id: number) => void;
  onMove: (id: number, dir: "up" | "down") => void;
}) {
  return (
    <section className="flex min-h-[140px] flex-col rounded-2xl border border-line bg-ink2/60">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          {label}
        </h2>
        <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
          {cards.length}
        </span>
      </header>
      <div className="flex-1 space-y-2.5 p-3">
        {cards.length === 0 && (
          <p className="px-1 py-3 text-center text-xs text-muted/60">
            {colKey === "lineup" ? "Nothing queued yet" : "Nothing here"}
          </p>
        )}
        {cards.map((r) => (
          <Card
            key={r.id}
            request={r}
            colKey={colKey}
            readonly={readonly}
            onOpen={onOpen}
            onMove={onMove}
          />
        ))}
      </div>
    </section>
  );
}

/* ============================ Card ============================ */

function Card({
  request,
  colKey,
  readonly,
  onOpen,
  onMove,
}: {
  request: RequestLite;
  colKey: Column;
  readonly: boolean;
  onOpen: (id: number) => void;
  onMove: (id: number, dir: "up" | "down") => void;
}) {
  const due = colKey === "ongoing" ? dueStatus(request.due_at) : "none";
  return (
    <div
      className="group cursor-pointer rounded-xl border border-line bg-surface p-3.5 transition hover:border-line2"
      onClick={() => onOpen(request.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug">{request.title}</h3>
        {colKey === "lineup" && !readonly && (
          <div className="flex shrink-0 flex-col" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onMove(request.id, "up")}
              className="px-1 text-muted hover:text-paper"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => onMove(request.id, "down")}
              className="px-1 text-muted hover:text-paper"
              aria-label="Move down"
            >
              ↓
            </button>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full bg-ink2 px-2 py-0.5 text-muted">
          {request.type_name}
        </span>
        {request.phase_name && (
          <span className="rounded-full bg-surface2 px-2 py-0.5 text-muted">
            {request.phase_name}
          </span>
        )}
        {request.internal_status && CLIENT_STATUS[request.internal_status] && (
          <span className="rounded-full bg-surface2 px-2 py-0.5 text-muted">
            {CLIENT_STATUS[request.internal_status]}
          </span>
        )}
        {due === "overdue" && (
          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-300">
            Overdue
          </span>
        )}
        {due === "soon" && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
            Due soon
          </span>
        )}
        {colKey === "ongoing" &&
          request.target_completed_at &&
          (() => {
            const tag = dueTag(request.target_completed_at);
            const label =
              tag === "overdue"
                ? "Overdue target"
                : tag === "due_today"
                  ? "Target today"
                  : tag === "due_tomorrow"
                    ? "Target tomorrow"
                    : `Target ${shortDate(request.target_completed_at)}`;
            return (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-gold">
                {label}
              </span>
            );
          })()}
        {request.revision_count > 0 && (
          <span className="rounded-full bg-surface2 px-2 py-0.5 text-muted">
            rev {request.revision_count}
          </span>
        )}
      </div>

      {colKey === "for_approval" && request.latest_deliverable && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-gold/20 bg-gold-soft/20 px-2.5 py-2">
          {isImage(request.latest_deliverable) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={request.latest_deliverable}
              alt="deliverable"
              className="h-8 w-8 rounded-md object-cover"
            />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-md bg-surface2 text-xs text-muted">
              FILE
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-paper">
              Awaiting your approval
            </p>
            {request.approval_since && (
              <p className="text-[10px] text-muted">
                Auto-approves {fullDate(autoApproveDate(request.approval_since))}
              </p>
            )}
          </div>
        </div>
      )}

      {colKey === "done" && request.latest_deliverable && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-gold">✓</span>
          <a
            href={request.latest_deliverable}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="truncate text-xs font-medium text-gold hover:underline"
          >
            Download deliverable
          </a>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>
          Added {shortDate(request.created_at)}
          {request.comment_count > 0 && ` · ${request.comment_count} comment${request.comment_count === 1 ? "" : "s"}`}
        </span>
        {request.slot_consuming === 0 && (
          <span className="text-gold/80">No slot</span>
        )}
      </div>
    </div>
  );
}

/* ========================= New request modal ========================= */

function NewRequestModal({
  requestTypes,
  hasAiCreative,
  onClose,
  onCreated,
}: {
  requestTypes: RequestTypeLite[];
  hasAiCreative: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [rt, setRt] = useState<RequestTypeLite | null>(null);
  const [title, setTitle] = useState("");
  const [useAiSource, setUseAiSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const aiConfig = hasAiCreative && rt ? aiSourceFor(rt.slug) : null;
  const aiSeg = (active: boolean) =>
    `rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition ${
      active
        ? "border-gold bg-gold/10 text-gold"
        : "border-line bg-ink2 text-muted hover:border-gold/40"
    }`;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rt) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("request_type_id", String(rt.id));
      fd.set("title", title.trim());
      await api("/api/board/requests", { method: "POST", body: fd });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={rt ? rt.name : "New request"}>
      {!rt ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">What do you need?</p>
          {requestTypes.map((t) => (
            <button
              key={t.id}
              disabled={!t.available}
              onClick={() => {
                setUseAiSource(false);
                setRt(t);
              }}
              className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left ${
                t.available
                  ? "border-line bg-ink2 hover:border-gold/50"
                  : "cursor-not-allowed border-line bg-ink2 opacity-50"
              }`}
            >
              <div>
                <span className="text-sm font-semibold">{t.name}</span>
                {t.slot_consuming === 0 && (
                  <span className="ml-2 rounded-full bg-surface2 px-2 py-0.5 text-[10px] text-muted">
                    No slot
                  </span>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  {t.available
                    ? `~${t.sla_hours}h turn-around`
                    : t.reason}
                </p>
              </div>
              <span className="text-gold">{t.available ? "→" : "🔒"}</span>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Short, specific — e.g. Facebook post for product launch"
            />
          </div>
          {rt.brief_schema.map((f) => {
            if (aiConfig && f.key === aiConfig.field) {
              return (
                <div key={f.key} className="space-y-2">
                  <label className={labelCls}>
                    {aiConfig.segmentLabel}{" "}
                    <span className="text-gold"> *</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUseAiSource(false)}
                      className={aiSeg(!useAiSource)}
                    >
                      {aiConfig.linkLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseAiSource(true)}
                      className={aiSeg(useAiSource)}
                    >
                      {aiConfig.aiLabel}
                    </button>
                  </div>
                  {!useAiSource ? (
                    <BriefFieldInput key={f.key} field={f} />
                  ) : (
                    <>
                      <div>
                        <label className={labelCls}>
                          {aiConfig.promptLabel}{" "}
                          <span className="text-gold"> *</span>
                        </label>
                        <textarea
                          name={aiConfig.promptKey}
                          rows={3}
                          className={inputCls}
                          required
                          placeholder={aiConfig.promptPlaceholder}
                        />
                      </div>
                      <input
                        type="hidden"
                        name="use_ai_source"
                        value={rt.slug}
                      />
                    </>
                  )}
                </div>
              );
            }
            return <BriefFieldInput key={f.key} field={f} />;
          })}
          {error && <div className={errCls}>{error}</div>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setRt(null)}
              className="rounded-xl border border-line2 px-4 py-3 text-sm font-medium text-paper hover:border-gold/60"
            >
              Back
            </button>
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function BriefFieldInput({ field }: { field: BriefField }) {
  const base = field.required ? { required: true } : {};
  if (field.type === "textarea" || field.type === "links")
    return (
      <div>
        <label className={labelCls}>
          {field.label}
          {field.required && <span className="text-gold"> *</span>}
        </label>
        <textarea
          name={field.key}
          rows={3}
          className={inputCls}
          placeholder={field.placeholder}
          {...base}
        />
      </div>
    );
  if (field.type === "select")
    return (
      <div>
        <label className={labelCls}>
          {field.label}
          {field.required && <span className="text-gold"> *</span>}
        </label>
        <select name={field.key} className={inputCls} {...base}>
          <option value="" disabled>
            Select…
          </option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  if (field.type === "file")
    return (
      <div>
        <label className={labelCls}>
          {field.label}
          {field.required && <span className="text-gold"> *</span>}
        </label>
        <input
          type="file"
          name={field.key}
          multiple
          className="w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-paper"
          accept="image/*,.pdf,.zip,.doc,.docx,.mp4,.mov"
          {...base}
        />
      </div>
    );
  return (
    <div>
      <label className={labelCls}>
        {field.label}
        {field.required && <span className="text-gold"> *</span>}
      </label>
      <input
        type={field.type === "number" ? "number" : field.type === "url" ? "url" : field.type === "date" ? "date" : "text"}
        name={field.key}
        className={inputCls}
        placeholder={field.placeholder}
        {...base}
      />
    </div>
  );
}

/* ========================= Detail modal ========================= */

function DetailModal({
  requestId,
  accountId,
  readonly,
  onClose,
  onChanged,
}: {
  requestId: number;
  accountId: number;
  readonly: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [showRevision, setShowRevision] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setDetail(await api<RequestDetail>(`/api/board/requests/${requestId}`));
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    api<RequestDetail>(`/api/board/requests/${requestId}`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function approve() {
    setBusy(true);
    try {
      await api(`/api/board/requests/${requestId}/approve`, { method: "POST" });
      onChanged();
      await load();
    } catch (e) {
      setLoadErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitRevision() {
    if (!revisionNote.trim()) return;
    setBusy(true);
    try {
      await api(`/api/board/requests/${requestId}/revision`, {
        method: "POST",
        json: { note: revisionNote.trim() },
      });
      setShowRevision(false);
      setRevisionNote("");
      onChanged();
      await load();
    } catch (e) {
      setLoadErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api(`/api/board/requests/${requestId}/comments`, {
        method: "POST",
        json: { body: comment.trim() },
      });
      setComment("");
      onChanged();
      await load();
    } catch (e) {
      setLoadErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) {
        const file = f.type.startsWith("image/") ? await compressImage(f, 1600, 0.8) : f;
        fd.append("file", file);
      }
      await api(`/api/board/requests/${requestId}/attachments`, {
        method: "POST",
        body: fd,
      });
      onChanged();
      await load();
    } catch (e) {
      setLoadErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !loadErr)
    return (
      <Modal onClose={onClose} title="Loading…">
        <p className="py-6 text-center text-sm text-muted">Loading request…</p>
      </Modal>
    );

  const briefPairs = detail
    ? (() => {
        const answers = detail.brief_answers as Record<string, unknown>;
        const aiConfig = aiSourceFor(detail.type_slug);
        const aiActive =
          !!aiConfig && answers.use_ai_source === detail.type_slug;
        return detail.brief_schema
          .filter((f) => answers[f.key] !== undefined)
          .filter((f) => !(aiActive && aiConfig && f.key === aiConfig.field))
          .map((f) => {
            const v: unknown = answers[f.key];
            const isArray = Array.isArray(v);
            const text = isArray ? (v as string[]).join("\n") : String(v ?? "");
            const urls = isArray ? (v as string[]) : f.type === "url" || f.type === "links" ? [text] : [];
            return { field: f, text, urls };
          })
          .concat(
            aiActive && aiConfig && answers[aiConfig.promptKey]
              ? [
                  {
                    field: {
                      key: aiConfig.promptKey,
                      label: aiConfig.promptLabel,
                      type: "textarea" as const,
                    },
                    text: String(answers[aiConfig.promptKey]),
                    urls: [] as string[],
                  },
                ]
              : []
          );
      })()
    : [];

  return (
    <Modal onClose={onClose} title={detail?.title ?? "Request"}>
      {loadErr && <div className={errCls}>{loadErr}</div>}

      {detail && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-surface2 px-2.5 py-1 text-muted">
              {detail.type_name}
            </span>
            <span className="rounded-full bg-surface2 px-2.5 py-1 text-muted">
              {detail.column === "lineup"
                ? "Project Lineup"
                : detail.column === "ongoing"
                  ? "Ongoing"
                  : detail.column === "for_approval"
                    ? "For Approval"
                    : "Done"}
            </span>
            {detail.internal_status && CLIENT_STATUS[detail.internal_status] && (
              <span className="rounded-full bg-gold-soft/40 px-2.5 py-1 text-gold">
                {CLIENT_STATUS[detail.internal_status]}
              </span>
            )}
            {detail.revision_count > 0 && (
              <span className="rounded-full bg-surface2 px-2.5 py-1 text-muted">
                Revision {detail.revision_count}
              </span>
            )}
            <span className="text-muted">
              Submitted {timeAgo(detail.created_at)}
            </span>
          </div>

          {detail.due_at && detail.column === "ongoing" && (
            <div className="rounded-xl border border-line bg-ink2 px-4 py-3 text-sm">
              {dueStatus(detail.due_at) === "overdue" ? (
                <span className="text-rose-300">
                  Overdue — {fullDate(detail.due_at)}
                </span>
              ) : (
                <span className="text-muted">
                  Due {fullDate(detail.due_at)}
                </span>
              )}
            </div>
          )}

          {detail.target_completed_at && detail.column === "ongoing" && (
            <div className="rounded-xl border border-line bg-gold-soft/20 px-4 py-3 text-sm">
              <span className="text-gold">
                Target completion — {fullDate(detail.target_completed_at)}
              </span>
            </div>
          )}

          {/* Deliverables */}
          {detail.deliverables.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Deliverables
              </h3>
              <div className="mt-2 space-y-2">
                {detail.deliverables
                  .slice()
                  .reverse()
                  .map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 rounded-xl border border-line bg-ink2 px-3 py-2.5"
                    >
                      {isImage(d.file_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.file_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface2 text-[10px] font-bold text-muted">
                          FILE
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm font-semibold text-gold hover:underline"
                        >
                          Version {d.version}
                        </a>
                        <p className="text-xs text-muted">
                          Uploaded {timeAgo(d.uploaded_at)}
                          {d.approval_state === "approved" && " · Approved"}
                        </p>
                      </div>
                      {d.version === detail.deliverables[detail.deliverables.length - 1].version && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
                          LATEST
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Approval actions */}
          {detail.column === "for_approval" && !readonly && (
            <div className="rounded-xl border border-gold/20 bg-gold-soft/20 p-4">
              <p className="text-sm font-semibold text-paper">
                Is this good to go?
              </p>
              {detail.approval_since && (
                <p className="mt-0.5 text-xs text-muted">
                  Auto-approves {fullDate(autoApproveDate(detail.approval_since))}{" "}
                  if you don&apos;t respond.
                </p>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={approve}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => setShowRevision((s) => !s)}
                  className="flex-1 rounded-xl border border-line2 px-4 py-3 text-sm font-medium text-paper hover:border-gold/60"
                >
                  Request changes
                </button>
              </div>
              {showRevision && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                    className={inputCls}
                    rows={3}
                    placeholder="Tell us exactly what to change…"
                  />
                  <button
                    onClick={submitRevision}
                    disabled={busy || !revisionNote.trim()}
                    className="rounded-xl bg-surface2 px-4 py-2.5 text-sm font-medium text-paper hover:bg-surface hover:disabled:opacity-50"
                  >
                    Send revision request
                  </button>
                </div>
              )}
            </div>
          )}

          {detail.column === "done" && detail.auto_approved === 1 && (
            <p className="text-xs text-muted">
              Auto-approved after 3 business days with no response.
            </p>
          )}

          {/* Brief */}
          {briefPairs.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Your brief
              </h3>
              <dl className="mt-2 space-y-3">
                {briefPairs.map(({ field, text, urls }) => (
                  <div key={field.key}>
                    <dt className="text-xs font-semibold text-muted">
                      {field.label}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm text-paper">
                      {text}
                      {urls.length > 0 && (
                        <span className="mt-1 block space-y-0.5">
                          {urls.map((u) => (
                            <a
                              key={u}
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-gold hover:underline"
                            >
                              {u}
                            </a>
                          ))}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Attachments */}
          {detail.attachments.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Files
              </h3>
              <div className="mt-2 space-y-1.5">
                {detail.attachments.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm text-gold hover:underline"
                  >
                    {a.url.split("/").pop()}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              Comments ({detail.comments.length})
            </h3>
            <div className="mt-2 max-h-56 space-y-3 overflow-y-auto pr-1 board-scroll">
              {detail.comments.length === 0 && (
                <p className="text-sm text-muted">No comments yet.</p>
              )}
              {detail.comments
                .filter((c) => c.internal_only === 0)
                .map((c) => (
                <div key={c.id} className="text-sm">
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-paper2">
                      {c.author_account_id === accountId
                        ? "You"
                        : c.author_role === "admin"
                          ? "PodiumSet team"
                          : c.author_email}
                    </span>{" "}
                    · {timeAgo(c.created_at)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-paper">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
            {!readonly && (
              <div className="mt-3 flex gap-2">
                <input
                  className={inputCls}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void addComment();
                    }
                  }}
                  placeholder="Write a comment…"
                />
                <button
                  onClick={addComment}
                  disabled={busy || !comment.trim()}
                  className="rounded-xl bg-gold px-4 text-sm font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            )}
          </div>

          {/* Upload attachments */}
          {!readonly && (
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => uploadFiles(e.target.files)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="rounded-xl border border-dashed border-line2 px-4 py-2.5 text-sm text-muted hover:border-gold/50 hover:text-paper disabled:opacity-50"
              >
                + Attach reference files
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ========================= Brand modal ========================= */

function BrandModal({
  brand,
  onClose,
  onSaved,
}: {
  brand: BrandLite | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    colors: brand?.colors ?? "",
    fonts: brand?.fonts ?? "",
    tone: brand?.tone ?? "",
    links: brand?.links ?? "",
    avoid_notes: brand?.avoid_notes ?? "",
  });
  const [logo_urls, setLogoUrls] = useState<string[]>(() => {
    try {
      const v = JSON.parse(brand?.logo_urls || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function uploadLogos(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const file = f.type.startsWith("image/") ? await compressImage(f) : f;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "brand");
      try {
        const res = await api<{ url: string }>("/api/upload", {
          method: "POST",
          body: fd,
        });
        setLogoUrls((cur) => [...cur, res.url]);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api("/api/account/brand", {
        method: "POST",
        json: { ...form, logo_urls },
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Brand profile">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          This is our single source of truth for your brand. It saves revisions
          on every request.
        </p>
        <div>
          <label className={labelCls}>Logos</label>
          {logo_urls.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {logo_urls.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="logo" className="h-14 w-14 rounded-lg border border-line object-cover" />
              ))}
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-line2 bg-ink2 px-4 py-4 text-sm text-muted">
            Upload logo(s)
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => uploadLogos(e.target.files)}
            />
          </label>
        </div>
        {(
          [
            ["colors", "Brand colors"],
            ["fonts", "Fonts"],
            ["tone", "Brand tone"],
            ["links", "Links"],
            ["avoid_notes", "Anything to avoid"],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <label className={labelCls}>{label}</label>
            {k === "tone" || k === "links" || k === "avoid_notes" ? (
              <textarea
                className={inputCls}
                rows={2}
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
              />
            ) : (
              <input
                className={inputCls}
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
              />
            )}
          </div>
        ))}
        {error && <div className={errCls}>{error}</div>}
        <button onClick={save} disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : "Save brand profile"}
        </button>
      </div>
    </Modal>
  );
}

/* ========================= Modal shell ========================= */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 board-scroll sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-ink2 text-muted hover:text-paper"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
