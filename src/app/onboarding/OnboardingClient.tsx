"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/compress";
import { peso } from "@/lib/format";
import { inputCls, labelCls, primaryBtn, cardCls, errCls } from "@/components/form";
import { PAYMENT_METHODS, paymentInfo } from "@/lib/payinfo";
import { Logo } from "@/components/Logo";
import type { PlanRow, AddonRow, BrandProfileRow } from "@/lib/types";

export interface PaymentLite {
  id: number;
  status: string;
  amount_php: number;
  method: string;
  reference_no: string | null;
  proof_url: string | null;
  created_at: string;
  rejection_reason: string | null;
}

interface Props {
  plans: PlanRow[];
  addons: AddonRow[];
  brand: BrandProfileRow | null;
  subscriptionStatus: string;
  initialPlanId: number | null;
  initialAddonIds: number[];
  latestPayment: PaymentLite | null;
}

const STEPS = [
  { n: 1, label: "Package" },
  { n: 2, label: "Payment" },
  { n: 3, label: "Brand intake" },
];

export function Onboarding({
  plans,
  addons,
  brand,
  subscriptionStatus,
  initialPlanId,
  initialAddonIds,
  latestPayment,
}: Props) {
  const router = useRouter();
  const isWaiting =
    subscriptionStatus === "pending_payment" && latestPayment?.status === "pending";
  const isRejected =
    subscriptionStatus === "rejected" && latestPayment?.status === "rejected";

  const [step, setStep] = useState<1 | 2 | 3>(
    isWaiting || isRejected ? 2 : initialPlanId ? 2 : 1
  );
  const [planId, setPlanId] = useState<number | null>(initialPlanId);
  const [addonIds, setAddonIds] = useState<number[]>(initialAddonIds);
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(!isWaiting);
  const [paid, setPaid] = useState<PaymentLite | null>(null);
  const [logo_urls, setLogoUrls] = useState<string[]>(() => {
    try {
      const v = JSON.parse(brand?.logo_urls || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });

  const plan = plans.find((p) => p.id === planId) ?? null;

  const shownPayment = paid ?? latestPayment;

  const total = useMemo(() => {
    let t = plan?.price_php ?? 0;
    for (const id of addonIds) {
      const a = addons.find((x) => x.id === id);
      if (a) t += plan ? a.bundled_price_php : a.price_php;
    }
    return t;
  }, [plan, addonIds, addons]);

  function addonAllowed(a: AddonRow): boolean {
    if (a.requires_plan && !plan) return false;
    const allowed: number[] = JSON.parse(a.allowed_plans || "[]");
    if (allowed.length > 0 && plan) return allowed.includes(plan.id);
    return true;
  }

  function toggleAddon(id: number) {
    setAddonIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  async function submitPackage() {
    if (!planId) {
      setError("Choose a package first.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api("/api/onboarding/package", {
        method: "POST",
        json: { plan_id: planId, addon_ids: addonIds },
      });
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment() {
    if (!proof) {
      setError("Upload proof of payment.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("method", method);
      fd.append("reference_no", reference);
      fd.append("proof", proof);
      await api("/api/onboarding/payment", { method: "POST", body: fd });
      setPaid({
        id: 0,
        status: "pending",
        amount_php: total,
        method,
        reference_no: reference || null,
        proof_url: proofUrl,
        created_at: "",
        rejection_reason: null,
      });
      setShowForm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitBrand(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const data = new FormData(e.currentTarget);
    const body = {
      colors: String(data.get("colors") ?? ""),
      fonts: String(data.get("fonts") ?? ""),
      tone: String(data.get("tone") ?? ""),
      links: String(data.get("links") ?? ""),
      avoid_notes: String(data.get("avoid_notes") ?? ""),
      logo_urls,
    };
    try {
      await api("/api/onboarding/brand", { method: "POST", json: body });
      router.push("/board");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
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

  async function pickProof(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    const file = f.type.startsWith("image/") ? await compressImage(f, 1600, 0.7) : f;
    setProof(file);
    setProofUrl(URL.createObjectURL(file));
  }

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Logo />
          <a href="/logout" onClick={handleLogout} className="text-sm text-muted hover:text-paper">
            Log out
          </a>
        </div>
      </header>

      {/* Stepper */}
      <div className="mx-auto max-w-2xl px-5 pt-8">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <div
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  step > s.n || (step === s.n)
                    ? "bg-gold text-ink"
                    : "bg-surface2 text-muted"
                }`}
              >
                {s.n}
              </div>
              <span
                className={`text-xs font-medium ${
                  step >= s.n ? "text-paper" : "text-muted"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="h-px flex-1 bg-line" />
              )}
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 py-8">
        {step === 1 && (
          <div className={cardCls}>
            <h1 className="text-xl font-bold">Pick your package</h1>
            <p className="mt-1 text-sm text-muted">
              One fixed price. Unlimited requests. Pause or cancel anytime.
            </p>

            <div className="mt-6 space-y-3">
              {plans
                .filter((p) => p.active_slots > 0)
                .map((p) => {
                  const selected = planId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanId(p.id)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-gold bg-gold-soft/40"
                          : "border-line bg-ink2 hover:border-line2"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold">{p.name}</span>
                          {p.featured > 0 && (
                            <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
                              Best choice
                            </span>
                          )}
                          <p className="mt-0.5 text-xs text-muted">{p.tagline}</p>
                        </div>
                        <span className="font-bold">{peso(p.price_php)}/mo</span>
                      </div>
                    </button>
                  );
                })}
            </div>

            {/* Add-ons */}
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Add-ons
              </p>
              <div className="mt-2 space-y-2">
                {addons.map((a) => {
                  const allowed = addonAllowed(a);
                  const on = addonIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!allowed}
                      onClick={() => toggleAddon(a.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm ${
                        !allowed
                          ? "cursor-not-allowed border-line bg-ink2 opacity-40"
                          : on
                            ? "border-gold bg-gold-soft/40"
                            : "border-line bg-ink2 hover:border-line2"
                      }`}
                    >
                      <div>
                        <span className="font-semibold">{a.name}</span>
                        <p className="text-xs text-muted">{a.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">
                          {plan ? peso(a.bundled_price_php) : peso(a.price_php)}
                        </span>
                        {a.bundled_price_php < a.price_php && plan && (
                          <span className="ml-1 text-xs text-muted line-through">
                            {peso(a.price_php)}
                          </span>
                        )}
                        <span className="block text-[10px] uppercase text-muted">
                          {on ? "Added" : "Add"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-line bg-ink2 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">Monthly total</span>
                <span className="text-2xl font-bold">{peso(total)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {peso(total)} for 30 days. Cancel or pause anytime.
              </p>
            </div>

            {error && <div className={`mt-4 ${errCls}`}>{error}</div>}

            <button
              onClick={submitPackage}
              disabled={busy || !planId}
              className={`mt-6 ${primaryBtn}`}
            >
              {busy ? "Saving…" : "Continue to payment"}
            </button>
          </div>
        )}

        {step === 2 && (
          <>
            {(isWaiting || paid) && !showForm && (
              <div className={cardCls}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-soft text-gold">
                    ✓
                  </span>
                  <div>
                    <h1 className="text-lg font-bold">Payment received</h1>
                    <p className="text-sm text-muted">
                      We&apos;re verifying it now.
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-line bg-ink2 p-4 text-sm">
                  {shownPayment ? (
                    <>
                      <p className="text-muted">Amount: <span className="text-paper font-semibold">{peso(shownPayment.amount_php)}</span></p>
                      <p className="text-muted">Method: <span className="text-paper">{shownPayment.method}</span></p>
                      {shownPayment.reference_no && (
                        <p className="text-muted">Reference: <span className="text-paper">{shownPayment.reference_no}</span></p>
                      )}
                      {shownPayment.proof_url && (
                        <p className="mt-2">
                          <a href={shownPayment.proof_url} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                            View uploaded proof
                          </a>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted">Your proof of payment has been submitted and is awaiting verification.</p>
                  )}
                </div>
                <p className="mt-4 text-sm text-muted">
                  Verification typically takes a few hours during business
                  hours. You&apos;ll get an email when it&apos;s approved. Meanwhile,
                  fill in your brand intake — it saves us a round of revisions
                  later.
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => setStep(3)} className={primaryBtn}>
                    Fill in brand intake
                  </button>
                  <button
                    onClick={() => setShowForm(true)}
                    className="rounded-xl border border-line2 px-4 py-3 text-sm font-medium text-paper hover:border-gold/60"
                  >
                    Upload a different proof
                  </button>
                </div>
              </div>
            )}

            {showForm && (
              <div className={cardCls}>
                <h1 className="text-xl font-bold">Pay to activate</h1>
                <p className="mt-1 text-sm text-muted">
                  {peso(total)} for 30 days. Cancel or pause anytime.
                </p>

                {isRejected && latestPayment?.rejection_reason && (
                  <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    <strong>Your payment was rejected.</strong>{" "}
                    {latestPayment.rejection_reason}
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  <div>
                    <label className={labelCls}>Payment method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMethod(m)}
                          className={`rounded-xl border px-2 py-2.5 text-xs font-semibold ${
                            method === m
                              ? "border-gold bg-gold-soft/40 text-gold"
                              : "border-line bg-ink2 text-muted hover:border-line2"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-ink2 p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {paymentInfo(method).label} payment details
                    </p>
                    <img
                      src={paymentInfo(method).image}
                      alt={`${paymentInfo(method).label} payment details`}
                      className="mt-3 w-full rounded-lg border border-line"
                    />
                    <p className="mt-3 text-xs text-muted">
                      {paymentInfo(method).note}
                    </p>
                  </div>

                  <div>
                    <label className={labelCls}>Reference number (optional)</label>
                    <input
                      className={inputCls}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="e.g. 1234567890"
                    />
                  </div>

                  <div>
                    <label className={labelCls}>
                      Proof of payment (image or PDF, max 10 MB)
                    </label>
                    {proofUrl ? (
                      <div className="rounded-xl border border-line bg-ink2 p-3">
                        <img
                          src={proofUrl}
                          alt="proof preview"
                          className="max-h-40 w-auto rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setProof(null);
                            setProofUrl(null);
                          }}
                          className="mt-2 text-xs text-rose-400 hover:underline"
                        >
                          Remove and re-upload
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line2 bg-ink2 px-4 py-8 text-center">
                        <span className="text-sm text-muted">
                          Tap to upload a screenshot of the payment
                        </span>
                        <span className="mt-1 text-xs text-muted/60">
                          GCash, BDO, or GoTyme receipt or screenshot
                        </span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => pickProof(e.target.files)}
                        />
                      </label>
                    )}
                  </div>

                  {error && <div className={errCls}>{error}</div>}

                  <button
                    onClick={submitPayment}
                    disabled={busy}
                    className={primaryBtn}
                  >
                    {busy ? "Uploading…" : "Submit payment proof"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <form onSubmit={submitBrand} className={cardCls}>
            <h1 className="text-xl font-bold">Brand intake</h1>
            <p className="mt-1 text-sm text-muted">
              This becomes your permanent Brand Profile — it&apos;s the single
              best thing you can give us to avoid revisions. You can edit it
              anytime from your board.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className={labelCls}>Logo files</label>
                {logo_urls.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {logo_urls.map((u) => (
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

              <div>
                <label className={labelCls}>Brand colors</label>
                <input className={inputCls} name="colors" defaultValue={brand?.colors ?? ""} placeholder="e.g. Deep green #1B4D3E, cream #F5F0E6" />
              </div>
              <div>
                <label className={labelCls}>Fonts</label>
                <input className={inputCls} name="fonts" defaultValue={brand?.fonts ?? ""} placeholder="e.g. Montserrat for headings, Open Sans for body" />
              </div>
              <div>
                <label className={labelCls}>Brand tone</label>
                <textarea className={`${inputCls} min-h-20`} name="tone" defaultValue={brand?.tone ?? ""} placeholder="One or two sentences describing your voice, e.g. 'Friendly, trustworthy, no jargon.'" />
              </div>
              <div>
                <label className={labelCls}>Links</label>
                <textarea className={`${inputCls} min-h-16`} name="links" defaultValue={brand?.links ?? ""} placeholder="Website, Facebook, Instagram, TikTok, Google Drive / Dropbox folder (one per line)" />
              </div>
              <div>
                <label className={labelCls}>Anything to avoid</label>
                <textarea className={`${inputCls} min-h-16`} name="avoid_notes" defaultValue={brand?.avoid_notes ?? ""} placeholder="Competitors, banned colors, past designs that missed the mark" />
              </div>

              {error && <div className={errCls}>{error}</div>}

              <div className="flex flex-col gap-2">
                <button type="submit" disabled={busy} className={primaryBtn}>
                  {busy ? "Saving…" : "Save and go to my board"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/board")}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-muted hover:text-paper"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );

  async function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }
}
