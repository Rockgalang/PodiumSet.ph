"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { peso, timeAgo } from "@/lib/format";
import { inputCls, errCls } from "@/components/form";
import type { PaymentRow } from "@/lib/types";

type PaymentWithBusiness = PaymentRow & { business_name: string };

export function PaymentsClient({
  payments,
}: {
  payments: PaymentWithBusiness[];
}) {
  const router = useRouter();
  const [days, setDays] = useState<Record<number, number>>({});
  const [reason, setReason] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function act(id: number, path: string, body: unknown) {
    setBusyId(id);
    setError("");
    try {
      await api(`/api/admin/payments/${id}/${path}`, {
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

  if (payments.length === 0)
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">
        All caught up — no pending payments.
      </div>
    );

  return (
    <div className="space-y-4">
      {error && <div className={errCls}>{error}</div>}
      {payments.map((p) => (
        <div
          key={p.id}
          className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[140px_1fr]"
        >
          <div className="flex flex-col gap-2">
            <div className="grid h-32 w-full place-items-center overflow-hidden rounded-xl border border-line bg-ink2">
              {p.proof_url && /\.(png|jpe?g|webp|gif|svg)$/i.test(p.proof_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.proof_url}
                  alt="proof"
                  className="h-full w-full object-cover"
                />
              ) : (
                <a
                  href={p.proof_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gold hover:underline"
                >
                  View file
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-bold">{p.business_name}</h2>
                <p className="text-xs text-muted">
                  {p.reference_no ? `Ref: ${p.reference_no}` : "No reference"} ·{" "}
                  submitted {timeAgo(p.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gold">
                  {peso(p.amount_php)}
                </p>
                <p className="text-xs text-muted">via {p.method}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Days to grant
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className={inputCls}
                    value={days[p.id] ?? 30}
                    onChange={(e) =>
                      setDays((d) => ({
                        ...d,
                        [p.id]: Number(e.target.value),
                      }))
                    }
                  />
                  <button
                    onClick={() =>
                      act(p.id, "verify", { days_granted: days[p.id] ?? 30 })
                    }
                    disabled={busyId === p.id}
                    className="rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Rejection reason
                </label>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    placeholder="Required to reject"
                    value={reason[p.id] ?? ""}
                    onChange={(e) =>
                      setReason((r) => ({ ...r, [p.id]: e.target.value }))
                    }
                  />
                  <button
                    onClick={() =>
                      act(p.id, "reject", { reason: reason[p.id] ?? "" })
                    }
                    disabled={busyId === p.id || !(reason[p.id] ?? "").trim()}
                    className="rounded-xl border border-rose-500/40 px-4 py-3 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
