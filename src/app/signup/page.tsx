"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { inputCls, labelCls, primaryBtn, cardCls, errCls } from "@/components/form";
import { Logo } from "@/components/Logo";

const INDUSTRIES = [
  "Food & beverage",
  "Retail & e-commerce",
  "Services",
  "Health & wellness",
  "Real estate",
  "Education",
  "Travel & hospitality",
  "Professional services",
  "Other",
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    mobile: "",
    viber: "",
    viber_same: false,
    city: "",
    password: "",
    industry: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleViberSame(checked: boolean) {
    setForm((f) => ({
      ...f,
      viber_same: checked,
      viber: checked ? f.mobile : f.viber,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        json: { ...form, viber_same: form.viber_same ? "1" : "0" },
      });
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className={cardCls}>
          <h1 className="text-xl font-bold">Start your subscription</h1>
          <p className="mt-1 text-sm text-muted">
            Two minutes. No TIN, no billing address — we keep it simple.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className={labelCls}>Business name</label>
              <input
                required
                className={inputCls}
                value={form.business_name}
                onChange={(e) => set("business_name", e.target.value)}
                placeholder="Acme Trading Co."
              />
            </div>
            <div>
              <label className={labelCls}>Contact person</label>
              <input
                required
                className={inputCls}
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
                placeholder="Maria Santos"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                required
                className={inputCls}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@business.com"
              />
            </div>
            <div>
              <label className={labelCls}>Mobile number</label>
              <input
                required
                className={inputCls}
                value={form.mobile}
                onChange={(e) => {
                  set("mobile", e.target.value);
                  if (form.viber_same) set("viber", e.target.value);
                }}
                placeholder="0917 123 4567"
              />
            </div>
            <div>
              <label className={labelCls}>Viber number</label>
              <input
                required={!form.viber_same}
                disabled={form.viber_same}
                className={inputCls + (form.viber_same ? " opacity-50" : "")}
                value={form.viber}
                onChange={(e) => set("viber", e.target.value)}
                placeholder="0917 123 4567"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-paper2">
              <input
                type="checkbox"
                checked={form.viber_same}
                onChange={(e) => toggleViberSame(e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              My Viber is the same as my mobile number
            </label>
            <div>
              <label className={labelCls}>City / address</label>
              <input
                className={inputCls}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="e.g. Makati City"
              />
            </div>
            <div>
              <label className={labelCls}>Industry (optional)</label>
              <select
                className={inputCls}
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
              >
                <option value="">Select…</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input
                type="password"
                required
                minLength={8}
                className={inputCls}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            {error && <div className={errCls}>{error}</div>}
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          Already a client?{" "}
          <Link href="/login" className="font-semibold text-gold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
