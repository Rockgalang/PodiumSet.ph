"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { errCls } from "@/components/form";
import { dueTag, DUE_TAG_LABEL, targetDateValue } from "@/lib/workdays";
import { COLUMNS } from "@/lib/state";
import type { Column } from "@/lib/types";

interface KanbanReq {
  id: number;
  title: string;
  column: string;
  position: number;
  target_completed_at: string | null;
  due_at: string | null;
  phase_id: number | null;
  type_name: string;
  phase_name: string | null;
  subtask_total: number;
  subtask_done: number;
}

interface PhaseRow {
  id: number;
  name: string;
}

interface Subtask {
  id: number;
  request_id: number;
  title: string;
  done: number;
  position: number;
  created_at: string;
}

type Drag =
  | { kind: "request"; id: number; fromColumn: Column; fromIndex: number }
  | null;

const inputCls =
  "w-full rounded-xl border border-line bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-muted/70 focus:border-gold/70 focus:outline-none";

const COLUMN_STYLE: Record<string, string> = {
  lineup: "bg-surface2 text-muted",
  ongoing: "bg-gold/15 text-gold",
  for_approval: "bg-amber-500/15 text-amber-300",
  done: "bg-emerald-500/15 text-emerald-300",
};

export function ClientDashboardClient({
  accountId,
  requestTypes,
  initialPhases,
}: {
  accountId: number;
  requestTypes: Array<{ id: number; name: string; slug: string }>;
  initialPhases: PhaseRow[];
}) {
  const [requests, setRequests] = useState<KanbanReq[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>(initialPhases);
  const [drag, setDrag] = useState<Drag>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addColumn, setAddColumn] = useState<Column>("lineup");
  const [addForm, setAddForm] = useState({
    title: "",
    request_type_id: requestTypes[0]?.id ?? 0,
    phase_id: 0,
    target_completed_at: targetDateValue(),
  });
  const [editId, setEditId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const d = await api<{ requests: KanbanReq[]; phases: PhaseRow[] }>(
      `/api/admin/clients/${accountId}/kanban`
    );
    setRequests(d.requests);
    setPhases(d.phases);
  }, [accountId]);

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, [refresh]);

  const byColumn = useMemo(() => {
    const out: Record<Column, KanbanReq[]> = {
      lineup: [],
      ongoing: [],
      for_approval: [],
      done: [],
    };
    for (const r of requests) {
      const col = r.column as Column;
      (out[col] ?? out.lineup).push(r);
    }
    for (const col of Object.keys(out)) {
      out[col as Column].sort(
        (a, b) => a.position - b.position || b.id - a.id
      );
    }
    return out;
  }, [requests]);

  async function saveColumns(next: Record<Column, KanbanReq[]>) {
    setError("");
    try {
      await api(`/api/admin/clients/${accountId}/kanban`, {
        method: "POST",
        json: {
          columns: Object.fromEntries(
            Object.entries(next).map(([col, list]) => [
              col,
              list.map((r) => r.id),
            ])
          ),
        },
      });
    } catch (e) {
      setError((e as Error).message);
      refresh().catch(() => {});
    }
  }

  function moveRequest(
    id: number,
    fromColumn: Column,
    fromIndex: number,
    toColumn: Column,
    toIndex: number
  ) {
    const next = { ...byColumn };
    for (const col of ["lineup", "ongoing", "for_approval", "done"] as Column[]) {
      next[col] = [...next[col]];
    }
    const src = next[fromColumn];
    const item = src.splice(fromIndex, 1)[0];
    if (!item) return;
    let ti = toIndex;
    if (fromColumn === toColumn && fromIndex < ti) ti -= 1;
    next[toColumn].splice(Math.max(0, Math.min(ti, next[toColumn].length)), 0, item);
    setRequests(
      (["lineup", "ongoing", "for_approval", "done"] as Column[]).flatMap(
        (col) =>
          next[col].map((r, idx) => ({
            ...r,
            column: col,
            position: idx + 1,
          }))
      )
    );
    saveColumns(next);
  }

  function onDropCard(
    e: React.DragEvent,
    toColumn: Column,
    toIndex: number
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (drag?.kind === "request")
      moveRequest(drag.id, drag.fromColumn, drag.fromIndex, toColumn, toIndex);
    setDrag(null);
  }

  function onDropBody(e: React.DragEvent, toColumn: Column) {
    e.preventDefault();
    e.stopPropagation();
    if (drag?.kind === "request")
      moveRequest(
        drag.id,
        drag.fromColumn,
        drag.fromIndex,
        toColumn,
        byColumn[toColumn].length
      );
    setDrag(null);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function createRequest() {
    const title = addForm.title.trim();
    if (!title || !addForm.request_type_id || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/requests`, {
        method: "POST",
        json: {
          client_id: accountId,
          title,
          request_type_id: Number(addForm.request_type_id),
          target_completed_at: addForm.target_completed_at || null,
          phase_id: addForm.phase_id ? Number(addForm.phase_id) : null,
        },
      });
      setAddOpen(false);
      setAddForm({
        ...addForm,
        title: "",
        request_type_id: requestTypes[0]?.id ?? 0,
        phase_id: 0,
        target_completed_at: targetDateValue(),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openAdd(col: Column) {
    setAddColumn(col);
    setAddOpen(true);
  }

  return (
    <div className="space-y-4">
      {error && <div className={errCls}>{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => openAdd("lineup")}
          className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gold-strong"
        >
          + Add project
        </button>
        <span className="text-sm text-muted">
          Drag cards to move projects between columns and reorder.
        </span>
      </div>

      {addOpen && (
        <div className="rounded-2xl border border-line bg-ink2 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            New project → {COLUMNS.find((c) => c.key === addColumn)?.label}
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={addForm.title}
              onChange={(e) =>
                setAddForm({ ...addForm, title: e.target.value })
              }
              placeholder="Project title"
              className={inputCls}
            />
            <select
              value={addForm.request_type_id}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  request_type_id: Number(e.target.value),
                })
              }
              className={inputCls}
            >
              {requestTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={addForm.phase_id}
              onChange={(e) =>
                setAddForm({ ...addForm, phase_id: Number(e.target.value) })
              }
              className={inputCls}
            >
              <option value={0}>No phase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={addForm.target_completed_at}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  target_completed_at: e.target.value,
                })
              }
              className={inputCls}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={createRequest}
              disabled={busy || !addForm.title.trim()}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add project"}
            </button>
            <button
              onClick={() => setAddOpen(false)}
              className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-paper"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = byColumn[col.key];
          return (
            <section
              key={col.key}
              onDragOver={onDragOver}
              onDrop={(e) => onDropBody(e, col.key)}
              className={`flex min-h-[160px] flex-col rounded-2xl border border-line bg-ink2/60 ${
                drag && drag.fromColumn !== col.key ? "border-gold/50" : ""
              }`}
            >
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                  {col.clientLabel}
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                    {list.length}
                  </span>
                  <button
                    onClick={() => openAdd(col.key)}
                    className="rounded-md px-1.5 py-0.5 text-sm text-muted hover:bg-surface2 hover:text-paper"
                    title={`Add project to ${col.label}`}
                  >
                    +
                  </button>
                </div>
              </header>
              <div className="flex-1 space-y-2.5 p-3">
                {list.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs text-muted/60">
                    Drop projects here
                  </p>
                )}
                {list.map((r, i) => {
                  const tag = dueTag(r.target_completed_at);
                  return (
                    <div
                      key={r.id}
                      draggable
                      onDragStart={(e) => {
                        setDrag({
                          kind: "request",
                          id: r.id,
                          fromColumn: col.key,
                          fromIndex: i,
                        });
                        e.dataTransfer.setData("text/plain", String(r.id));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDrag(null)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDropCard(e, col.key, i)}
                      className="group cursor-grab rounded-xl border border-line bg-surface p-3.5 transition-colors hover:border-gold/40 active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold leading-snug">
                          {r.title}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditId(r.id);
                          }}
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-muted opacity-0 transition-opacity hover:bg-surface2 hover:text-paper group-hover:opacity-100"
                          title="Edit project"
                        >
                          ✎
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full bg-ink2 px-2 py-0.5 text-muted">
                          {r.type_name}
                        </span>
                        {r.phase_name && (
                          <span
                            className={`rounded-full px-2 py-0.5 ${COLUMN_STYLE[r.column] ?? "bg-surface2 text-muted"}`}
                          >
                            {r.phase_name}
                          </span>
                        )}
                        {r.target_completed_at && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${
                              tag === "overdue"
                                ? "bg-rose-500/15 text-rose-300"
                                : tag === "due_today"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-sky-500/15 text-sky-300"
                            }`}
                          >
                            {(tag ? DUE_TAG_LABEL[tag] : "Due soon") +
                              " · " +
                              shortDate(r.target_completed_at)}
                          </span>
                        )}
                        {r.subtask_total > 0 && (
                          <span className="rounded-full bg-surface2 px-2 py-0.5 text-muted">
                            {r.subtask_done}/{r.subtask_total} tasks
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {editId !== null && (
        <EditRequestModal
          accountId={accountId}
          requestId={editId}
          phases={phases}
          requestTypes={requestTypes}
          onClose={() => setEditId(null)}
          onChanged={async () => {
            await refresh();
          }}
        />
      )}
    </div>
  );
}

/* ===================== Edit / modify / break down ===================== */

function EditRequestModal({
  accountId,
  requestId,
  phases,
  requestTypes,
  onClose,
  onChanged,
}: {
  accountId: number;
  requestId: number;
  phases: PhaseRow[];
  requestTypes: Array<{ id: number; name: string; slug: string }>;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [req, setReq] = useState<
    | {
        id: number;
        title: string;
        request_type_id: number;
        phase_id: number | null;
        phase_name: string | null;
        target_completed_at: string | null;
        type_name: string;
        column: string;
      }
    | null
  >(null);
  const [subs, setSubs] = useState<Subtask[]>([]);
  const [subTitle, setSubTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const d = await api<{
      request: {
        id: number;
        title: string;
        request_type_id: number;
        phase_id: number | null;
        phase_name: string | null;
        target_completed_at: string | null;
        type_name: string;
        column: string;
      };
    }>(`/api/admin/requests/${requestId}`);
    setReq(d.request);
    const s = await api<{ subtasks: Subtask[] }>(
      `/api/admin/requests/${requestId}/subtasks`
    );
    setSubs(s.subtasks);
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function save() {
    if (!req) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/requests/${requestId}`, {
        method: "PATCH",
        json: {
          title: req.title.trim(),
          request_type_id: req.request_type_id,
          phase_id: req.phase_id,
          target_completed_at: req.target_completed_at || "",
        },
      });
      await onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeProject() {
    if (!window.confirm(`Delete "${req?.title}" permanently?`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/requests/${requestId}`, { method: "DELETE" });
      await onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addSubtask() {
    const title = subTitle.trim();
    if (!title) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/requests/${requestId}/subtasks`, {
        method: "POST",
        json: { title },
      });
      setSubTitle("");
      const s = await api<{ subtasks: Subtask[] }>(
        `/api/admin/requests/${requestId}/subtasks`
      );
      setSubs(s.subtasks);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSub(sub: Subtask) {
    setError("");
    try {
      await api(
        `/api/admin/requests/${requestId}/subtasks/${sub.id}`,
        {
          method: "PATCH",
          json: { done: !sub.done },
        }
      );
      const s = await api<{ subtasks: Subtask[] }>(
        `/api/admin/requests/${requestId}/subtasks`
      );
      setSubs(s.subtasks);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeSub(subId: number) {
    setError("");
    try {
      await api(`/api/admin/requests/${requestId}/subtasks/${subId}`, {
        method: "DELETE",
      });
      const s = await api<{ subtasks: Subtask[] }>(
        `/api/admin/requests/${requestId}/subtasks`
      );
      setSubs(s.subtasks);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 board-scroll sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Project</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-ink2 text-muted hover:text-paper"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && <div className={errCls}>{error}</div>}
        {!req ? (
          <p className="py-6 text-center text-sm text-muted">Loading…</p>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Title</span>
              <input
                value={req.title}
                onChange={(e) => setReq({ ...req, title: e.target.value })}
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Type</span>
                <select
                  value={req.request_type_id}
                  onChange={(e) =>
                    setReq({
                      ...req,
                      request_type_id: Number(e.target.value),
                    })
                  }
                  className={inputCls}
                >
                  {requestTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Phase</span>
                <select
                  value={req.phase_id ?? 0}
                  onChange={(e) =>
                    setReq({
                      ...req,
                      phase_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className={inputCls}
                >
                  <option value={0}>No phase</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">
                Target completion
              </span>
              <input
                type="date"
                value={
                  req.target_completed_at
                    ? req.target_completed_at.slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  setReq({ ...req, target_completed_at: e.target.value })
                }
                className={inputCls}
              />
            </label>

            <div className="rounded-xl border border-line bg-ink2 p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Break down ({subs.length})
              </h3>
              <ul className="mt-2 space-y-1.5">
                {subs.length === 0 && (
                  <p className="text-sm text-muted">
                    No sub-tasks yet. Add one to break this project down.
                  </p>
                )}
                {subs.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={!!sub.done}
                      onChange={() => toggleSub(sub)}
                      className="h-4 w-4 accent-gold"
                    />
                    <span
                      className={`flex-1 ${sub.done ? "text-muted line-through" : "text-paper"}`}
                    >
                      {sub.title}
                    </span>
                    <button
                      onClick={() => removeSub(sub.id)}
                      disabled={busy}
                      className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-rose-500/15 hover:text-rose-300"
                      title="Delete subtask"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <input
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                  placeholder="Add a sub-task…"
                  className={inputCls}
                />
                <button
                  onClick={addSubtask}
                  disabled={busy || !subTitle.trim()}
                  className="shrink-0 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={save}
                disabled={busy || !req.title.trim()}
                className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save project"}
              </button>
              <button
                onClick={removeProject}
                disabled={busy}
                className="rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
              >
                Delete project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}