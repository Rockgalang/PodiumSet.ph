"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { shortDate, timeAgo, fullDate } from "@/lib/format";
import { autoApproveDate, COLUMNS, INTERNAL_STATUSES } from "@/lib/state";
import { errCls } from "@/components/form";
import { aiSourceFor } from "@/lib/ai-source";
import { dueTag, DUE_TAG_LABEL, targetDateValue } from "@/lib/workdays";
import type { Column, InternalStatus } from "@/lib/types";

const inputClsAdmin =
  "w-full rounded-xl border border-line bg-ink2 px-4 py-3 text-sm text-paper placeholder:text-muted/70 focus:border-gold/70 focus:outline-none";

interface AdminBoardRow {
  id: number;
  account_id: number | null;
  request_type_id: number;
  title: string;
  brief_answers: string;
  column: Column;
  internal_status: InternalStatus | null;
  position: number;
  phase_id: number | null;
  phase_name: string | null;
  revision_count: number;
  due_at: string | null;
  target_completed_at: string | null;
  approval_since: string | null;
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
  business_name: string;
  priority_queue: number;
  plan_name: string | null;
  slots: number;
}

export function AdminBoardClient({
  rows,
  clients,
  requestTypes,
}: {
  rows: AdminBoardRow[];
  clients: Array<{ id: number; business_name: string; contact_name: string }>;
  requestTypes: Array<{
    id: number;
    slug: string;
    name: string;
    brief_schema: unknown;
  }>;
}) {
  const router = useRouter();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [clientFilter, setClientFilter] = useState<number>(0);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const filteredRows = useMemo(
    () => (clientFilter ? rows.filter((r) => r.account_id === clientFilter) : rows),
    [rows, clientFilter]
  );

  const byColumn: Record<Column, AdminBoardRow[]> = {
    lineup: [],
    ongoing: [],
    for_approval: [],
    done: [],
  };
  for (const r of filteredRows) byColumn[r.column].push(r);
  byColumn.lineup.sort((a, b) => b.priority_queue - a.priority_queue || a.position - b.position);
  byColumn.ongoing.sort((a, b) =>
    a.due_at && b.due_at ? (a.due_at < b.due_at ? -1 : 1) : 0
  );

  async function post(id: number, path: string, body: unknown) {
    setBusyId(id);
    setError("");
    try {
      await api(`/api/board/requests/${id}/${path}`, {
        method: "POST",
        json: body,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(id: number, action: string) {
    await post(id, "status", { action });
  }

  return (
    <div className="space-y-3">
      {error && <div className={errCls}>{error}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(Number(e.target.value))}
          className="rounded-xl border border-line bg-ink2 px-4 py-2.5 text-sm text-paper focus:border-gold/60 focus:outline-none"
        >
          <option value={0}>All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.business_name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setNewProjectOpen(true)}
          className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gold-strong"
        >
          + New project
        </button>
        {clientFilter > 0 && (
          <span className="text-xs text-muted">
            Showing {filteredRows.length} of {rows.length} cards
          </span>
        )}
        {clientFilter > 0 && (
          <a
            href={`/admin/clients/${clientFilter}/dashboard`}
            className="rounded-xl border border-line bg-ink2 px-4 py-2.5 text-sm font-semibold text-paper hover:border-gold/60"
          >
            Dashboard →
          </a>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <section
            key={col.key}
            className="flex min-h-[140px] flex-col rounded-2xl border border-line bg-ink2/60"
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                {col.label}
              </h2>
              <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                {byColumn[col.key].length}
              </span>
            </header>
            <div className="flex-1 space-y-2.5 p-3">
              {byColumn[col.key].length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-muted/60">
                  Empty
                </p>
              )}
              {byColumn[col.key].map((r) => (
                <AdminCard
                  key={r.id}
                  request={r}
                  busy={busyId === r.id}
                  onOpen={setDetailId}
                  onPromote={() => setStatus(r.id, "to_ongoing")}
                  onInternalStatus={(st) =>
                    post(r.id, "status", {
                      action: "internal_status",
                      internal_status: st,
                    })
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {detailId !== null && (
        <AdminDetailModal
          requestId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {newProjectOpen && (
        <NewProjectModal
          clients={clients}
          requestTypes={requestTypes}
          onClose={() => setNewProjectOpen(false)}
          onCreated={() => {
            setNewProjectOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NewProjectModal({
  clients,
  requestTypes,
  onClose,
  onCreated,
}: {
  clients: Array<{ id: number; business_name: string; contact_name: string }>;
  requestTypes: Array<{
    id: number;
    slug: string;
    name: string;
    brief_schema: unknown;
  }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [clientId, setClientId] = useState<number>(0);
  const [typeId, setTypeId] = useState<number>(requestTypes[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(targetDateValue());
  const [viber, setViber] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherEmail, setOtherEmail] = useState("");
  const [otherMobile, setOtherMobile] = useState("");
  const [otherViber, setOtherViber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isOther = clientId === -1;

  async function create() {
    if (!title.trim()) return setErr("Give the project a title.");
    if (clientId === 0) return setErr("Pick the client this project is for (or Others).");
    if (isOther && !otherName.trim())
      return setErr("Specify who this project is for (Others).");
    if (isOther && !otherEmail.trim())
      return setErr("Contact email is required for Others.");
    setBusy(true);
    setErr("");
    try {
      await api("/api/admin/requests", {
        method: "POST",
        json: isOther
          ? {
              request_type_id: typeId,
              title: title.trim(),
              target_completed_at: target || null,
              other_client_name: otherName.trim(),
              other_client_email: otherEmail.trim(),
              other_client_mobile: otherMobile.trim() || undefined,
              other_client_viber: otherViber.trim() || undefined,
            }
          : {
              client_id: clientId,
              request_type_id: typeId,
              title: title.trim(),
              target_completed_at: target || null,
              viber: viber.trim() || undefined,
            },
      });
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="New project">
      <div className="space-y-4">
        {err && <div className={errCls}>{err}</div>}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">
            Client
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(Number(e.target.value))}
            className={inputClsAdmin}
          >
            <option value={0}>Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name} ({c.contact_name})
              </option>
            ))}
            <option value={-1}>Others (not registered)</option>
          </select>
          {isOther && (
            <p className="mt-1.5 text-xs text-muted">
              For projects outside the subscription or not tied to a registered
              client.
            </p>
          )}
        </div>
        {isOther && (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">
                Client name
              </label>
              <input
                className={inputClsAdmin}
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="e.g. Grace Co. (walk-in)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">
                Contact email
              </label>
              <input
                type="email"
                className={inputClsAdmin}
                value={otherEmail}
                onChange={(e) => setOtherEmail(e.target.value)}
                placeholder="Contact's email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">
                Contact number
              </label>
              <input
                className={inputClsAdmin}
                value={otherMobile}
                onChange={(e) => setOtherMobile(e.target.value)}
                placeholder="Contact's number (optional)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">
                Viber number
              </label>
              <input
                className={inputClsAdmin}
                value={otherViber}
                onChange={(e) => setOtherViber(e.target.value)}
                placeholder="Contact's Viber (optional)"
              />
            </div>
          </>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">
            Project title
          </label>
          <input
            className={inputClsAdmin}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 social kit"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">
            Type
          </label>
          <select
            value={typeId}
            onChange={(e) => setTypeId(Number(e.target.value))}
            className={inputClsAdmin}
          >
            {requestTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">
            Target completion date (defaults to 2 working days)
          </label>
          <input
            type="date"
            className={inputClsAdmin}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">
            Viber number
          </label>
          <input
            className={inputClsAdmin}
            value={viber}
            onChange={(e) => setViber(e.target.value)}
            placeholder="Contact's Viber (optional)"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">          <button
            onClick={onClose}
            className="rounded-xl border border-line2 px-4 py-2.5 text-sm text-muted hover:text-paper"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={busy}
            className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add project"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AdminCard({
  request,
  busy,
  onOpen,
  onPromote,
  onInternalStatus,
}: {
  request: AdminBoardRow;
  busy: boolean;
  onOpen: (id: number) => void;
  onPromote: () => void;
  onInternalStatus: (st: InternalStatus | null) => void;
}) {
  const [deliverableOpen, setDeliverableOpen] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function uploadDeliverable(f: File | undefined) {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    if (note.trim()) fd.append("note", note.trim());
    await api(`/api/board/requests/${request.id}/deliverable`, {
      method: "POST",
      body: fd,
    });
    setDeliverableOpen(false);
    setNote("");
    router.refresh();
  }

  const priority = request.priority_queue > 0;

  return (
    <div
      className={`group cursor-pointer rounded-xl border bg-surface p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_12px_30px_-14px_rgba(0,0,0,0.85)] ${
        priority ? "border-gold/50" : "border-line"
      }`}
      onClick={() => onOpen(request.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug transition-colors group-hover:text-gold">
          {request.title}
        </h3>
        {priority && (
          <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
            PRIORITY
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {request.business_name} · {request.plan_name ?? "No plan"}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full bg-ink2 px-2 py-0.5 text-muted">
          {request.type_name}
        </span>
        {request.phase_name && (
          <span className="rounded-full bg-surface2 px-2 py-0.5 text-muted">
            {request.phase_name}
          </span>
        )}
        {request.column === "ongoing" && request.internal_status && (
          <span className="rounded-full bg-gold-soft/40 px-2 py-0.5 text-gold">
            {INTERNAL_STATUSES[request.internal_status]}
          </span>
        )}
        {request.revision_count > 0 && (
          <span className="rounded-full bg-surface2 px-2 py-0.5 text-muted">
            rev {request.revision_count}
          </span>
        )}
        {request.column === "ongoing" && request.due_at && (
          <span className="text-muted">due {shortDate(request.due_at)}</span>
        )}
        {request.column === "ongoing" && request.target_completed_at && (() => {
          const tag = dueTag(request.target_completed_at);
          return (
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                tag === "overdue"
                  ? "bg-rose-500/15 text-rose-300"
                  : tag === "due_today"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-sky-500/15 text-sky-300"
              }`}
            >
              {(tag ? DUE_TAG_LABEL[tag] : "Due soon") + " · " + shortDate(request.target_completed_at)}
            </span>
          );
        })()}
      </div>

      {request.column === "lineup" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPromote();
          }}
          disabled={busy}
          className="mt-2.5 w-full rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
        >
          Start (move to Ongoing)
        </button>
      )}

      {request.column === "ongoing" && (
        <div
          className="mt-2.5 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <select
            value={request.internal_status ?? ""}
            onChange={(e) =>
              onInternalStatus(
                e.target.value === "" ? null : (e.target.value as InternalStatus)
              )
            }
            className="w-full rounded-lg border border-line bg-ink2 px-2 py-1.5 text-xs text-paper focus:border-gold/60 focus:outline-none"
          >
            <option value="">— status —</option>
            {Object.entries(INTERNAL_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {deliverableOpen ? (
            <div className="rounded-lg border border-line bg-ink2 p-2.5">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-paper focus:border-gold/60 focus:outline-none"
                placeholder="Internal note (optional)"
              />
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => uploadDeliverable(e.target.files?.[0])}
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 rounded-lg bg-gold px-2 py-1.5 text-xs font-semibold text-ink"
                >
                  Upload file
                </button>
                <button
                  onClick={() => setDeliverableOpen(false)}
                  className="rounded-lg border border-line2 px-2 py-1.5 text-xs text-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDeliverableOpen(true)}
              className="w-full rounded-lg border border-dashed border-line2 px-3 py-2 text-xs font-medium text-muted hover:border-gold/50 hover:text-paper"
            >
              Upload deliverable…
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>Added {shortDate(request.created_at)}</span>
        {request.comment_count > 0 && (
          <span>
            {request.comment_count} comment
            {request.comment_count === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ======================== Detail (admin) ======================== */

interface AdminComment {
  id: number;
  body: string;
  created_at: string;
  author_email: string;
  author_role: string;
  internal_only: number;
}

interface AdminDetail {
  id: number;
  title: string;
  column: Column;
  internal_status: InternalStatus | null;
  revision_count: number;
  due_at: string | null;
  target_completed_at: string | null;
  approval_since: string | null;
  auto_approved: number;
  created_at: string;
  type_name: string;
  type_slug: string;
  business_name: string;
  contact_name: string;
  brief_schema: Array<{ key: string; label: string }>;
  brief_answers: Record<string, unknown>;
  deliverables: Array<{
    id: number;
    version: number;
    file_url: string;
    uploaded_at: string;
    approval_state: string;
  }>;
  comments: AdminComment[];
  attachments: Array<{ url: string; created_at: string }>;
}

function AdminDetailModal({
  requestId,
  onClose,
  onChanged,
}: {
  requestId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [err, setErr] = useState("");
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [targetBusy, setTargetBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<AdminDetail>(`/api/board/requests/${requestId}`)
      .then(async (d) => {
        if (!cancelled) {
          setDetail(d);
          await setTargetDate(d.target_completed_at ? d.target_completed_at.slice(0, 10) : "");
        }
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function addComment() {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api(`/api/board/requests/${requestId}/comments`, {
        method: "POST",
        json: { body: comment.trim(), internal_only: internal },
      });
      setComment("");
      onChanged();
      const d = await api<AdminDetail>(`/api/board/requests/${requestId}`);
      setDetail(d);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !err)
    return (
      <Modal onClose={onClose} title="Loading…">
        <p className="py-6 text-center text-sm text-muted">Loading…</p>
      </Modal>
    );

  const briefPairs = detail
    ? (() => {
        const answers = detail.brief_answers;
        const aiConfig = aiSourceFor(detail.type_slug);
        const aiActive =
          !!aiConfig && answers.use_ai_source === detail.type_slug;
        return detail.brief_schema
          .filter((f) => !(aiActive && aiConfig && f.key === aiConfig.field))
          .map((f) => {
            const v = answers[f.key];
            return {
              label: f.label,
              text: Array.isArray(v) ? v.join("\n") : String(v ?? ""),
            };
          })
          .concat(
            aiActive && aiConfig && answers[aiConfig.promptKey]
              ? [
                  {
                    label: aiConfig.promptLabel,
                    text: String(answers[aiConfig.promptKey]),
                  },
                ]
              : []
          );
      })()
    : [];

  return (
    <Modal onClose={onClose} title={detail?.title ?? "Request"}>
      {err && <div className={errCls}>{err}</div>}
      {detail && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-surface2 px-2.5 py-1 text-muted">
              {detail.type_name}
            </span>
            <span className="rounded-full bg-surface2 px-2.5 py-1 text-muted">
              {detail.business_name} · {detail.contact_name}
            </span>
            <span className="rounded-full bg-surface2 px-2.5 py-1 text-muted">
              {detail.column}
            </span>
            {detail.internal_status && (
              <span className="rounded-full bg-gold-soft/40 px-2.5 py-1 text-gold">
                {INTERNAL_STATUSES[detail.internal_status]}
              </span>
            )}
            <span className="text-muted">
              Submitted {timeAgo(detail.created_at)}
            </span>
          </div>

          {detail.column === "for_approval" && detail.approval_since && (
            <div className="rounded-xl border border-gold/20 bg-gold-soft/20 px-4 py-3 text-sm">
              Awaiting client approval · auto-approves{" "}
              {fullDate(autoApproveDate(detail.approval_since))}
            </div>
          )}

          <div className="rounded-xl border border-line bg-ink2 px-4 py-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              Target completion date
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-paper focus:border-gold/60 focus:outline-none"
                value={targetDate}
                onChange={(e) => { void setTargetDate(e.target.value); }}
              />
              <button
                onClick={async () => {
                  if (!targetDate) return;
                  setTargetBusy(true);
                  try {
                    await api(`/api/board/requests/${requestId}/status`, {
                      method: "POST",
                      json: { action: "set_target", target_date: targetDate },
                    });
                    onChanged();
                    const d = await api<AdminDetail>(
                      `/api/board/requests/${requestId}`
                    );
                    setDetail(d);
                  } catch (e) {
                    setErr((e as Error).message);
                  } finally {
                    setTargetBusy(false);
                  }
                }}
                disabled={targetBusy || !targetDate}
                className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
              >
                {targetBusy ? "Saving…" : "Save target"}
              </button>
            </div>
            {detail.target_completed_at && (
              <p className="mt-2 text-xs text-muted">
                Shown to client as “Target completion”.
              </p>
            )}
          </div>

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
                      className="flex items-center justify-between rounded-xl border border-line bg-ink2 px-3 py-2.5 text-sm"
                    >
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-gold hover:underline"
                      >
                        v{d.version} · {timeAgo(d.uploaded_at)}
                      </a>
                      <span className="text-xs text-muted">
                        {d.approval_state}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {briefPairs.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Brief
              </h3>
              <dl className="mt-2 space-y-2">
                {briefPairs.map((p, i) => (
                  <div key={i}>
                    <dt className="text-xs font-semibold text-muted">
                      {p.label}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm">
                      {p.text}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

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

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              Comments ({detail.comments.length})
            </h3>
            <div className="mt-2 max-h-56 space-y-3 overflow-y-auto pr-1 board-scroll">
              {detail.comments.length === 0 && (
                <p className="text-sm text-muted">No comments yet.</p>
              )}
              {detail.comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-paper2">
                      {c.author_role === "admin" ? "Team" : "Client"}
                      {c.author_email ? ` (${c.author_email})` : ""}
                    </span>{" "}
                    · {timeAgo(c.created_at)}
                  </p>
                  <p
                    className={`mt-0.5 whitespace-pre-wrap ${
                      c.internal_only ? "text-amber-200/90" : "text-paper"
                    }`}
                  >
                    {c.internal_only && (
                      <span className="mr-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                        Internal
                      </span>
                    )}
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className={inputClsAdmin}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void addComment();
                  }
                }}
                placeholder="Add a comment…"
              />
              <button
                onClick={addComment}
                disabled={busy || !comment.trim()}
                className="rounded-xl bg-gold px-4 text-sm font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                className="h-3.5 w-3.5 accent-gold"
              />
              Internal note (client can&apos;t see this)
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
}

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
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="animate-pop-in max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 board-scroll sm:rounded-2xl sm:p-6">
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
