"use client";

import { useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-paper"
            >
              <span>{item.q}</span>
              <span
                className={`text-gold transition-transform ${isOpen ? "rotate-45" : ""}`}
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-sm leading-relaxed text-muted">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
