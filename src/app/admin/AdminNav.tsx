"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/board", label: "Board" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
];

export function AdminNav({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="rounded-full bg-gold-soft/40 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-gold">
            Admin
          </span>
          {businessName && (
            <span className="hidden text-sm text-muted md:inline">
              {businessName}
            </span>
          )}
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active =
              l.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-surface2 text-paper"
                    : "text-muted hover:text-paper"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="ml-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-rose-300 hover:bg-ink2"
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
