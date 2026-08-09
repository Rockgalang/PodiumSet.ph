"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }
    api("/api/auth/verify-email", { method: "POST", json: { token } })
      .then(() => setState("done"))
      .catch((e) => {
        setState("error");
        setMessage((e as Error).message);
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8">
          {state === "working" && (
            <>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line2 border-t-gold" />
              <p className="mt-4 text-sm text-muted">Verifying your email…</p>
            </>
          )}
          {state === "done" && (
            <>
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                ✓
              </div>
              <h1 className="mt-4 text-lg font-bold">Email verified</h1>
              <p className="mt-2 text-sm text-muted">
                Your account is ready. Head to your portal to pick a package.
              </p>
              <Link
                href="/onboarding"
                className="mt-6 inline-block w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink hover:bg-gold-strong"
              >
                Continue onboarding
              </Link>
            </>
          )}
          {state === "error" && (
            <>
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-rose-500/15 text-rose-400">
                !
              </div>
              <h1 className="mt-4 text-lg font-bold">Couldn't verify</h1>
              <p className="mt-2 text-sm text-muted">{message}</p>
              <Link
                href="/board"
                className="mt-6 inline-block w-full rounded-xl border border-line2 px-4 py-3 text-sm font-medium text-paper hover:border-gold/60"
              >
                Go to my portal
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
