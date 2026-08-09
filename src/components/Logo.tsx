import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-gold text-ink">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
          <rect x="3" y="12" width="4" height="8" rx="1" fill="currentColor" />
          <rect x="10" y="7" width="4" height="13" rx="1" fill="currentColor" />
          <rect x="17" y="3" width="4" height="17" rx="1" fill="currentColor" />
        </svg>
      </span>
      <span className="text-[15px] font-bold tracking-tight">
        Podium<span className="text-gold">Set</span>
      </span>
    </Link>
  );
}
