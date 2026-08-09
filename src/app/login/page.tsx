"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { inputCls, labelCls, primaryBtn, cardCls, errCls } from "@/components/form";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; role: string }>("/api/auth/login", {
        method: "POST",
        json: { email, password },
      });
      router.push(res.role === "admin" ? "/admin" : "/board");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className={cardCls}>
          <h1 className="text-xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Log in to your portal.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                required
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
              />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input
                type="password"
                required
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <div className={errCls}>{error}</div>}
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          New to PodiumSet?{" "}
          <Link href="/signup" className="font-semibold text-gold hover:underline">
            Start a subscription
          </Link>
        </p>
      </div>
    </div>
  );
}
