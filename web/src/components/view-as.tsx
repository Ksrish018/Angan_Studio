"use client";

import { useEffect, useRef, useState } from "react";
import { setView } from "@/app/view-actions";
import type { Viewer } from "@/lib/auth";

// No sign-in by design: this switch shows the app as Nikhil, the front desk, or any designer sees it.
export function ViewAs({ me, team }: { me: Viewer; team: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const current = me.role === "designer" ? `designer:${me.designerId}` : me.role;
  const options = [
    { v: "founder", label: "Nikhil", sub: "Founder · everything" },
    { v: "front_desk", label: "Front desk", sub: "Review queue, no pricing" },
    ...team.map((d) => ({ v: `designer:${d.id}`, label: d.name, sub: "Designer · own consultations" })),
  ];

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-hairline bg-paper/70 py-1 pl-1 pr-3 text-[12px] text-ink-2 transition-colors hover:text-ink"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-[11px] text-paper">
          {me.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
        </span>
        <span className="hidden max-w-[110px] truncate sm:inline">{me.name}</span>
      </button>
      {open && (
        <div className="card anim-fade-up absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto p-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,.35)]">
          <p className="px-3 pb-2 pt-1 text-[11px] uppercase tracking-[0.14em] text-stone">Viewing as</p>
          <form action={setView}>
            {options.map((o) => (
              <button
                key={o.v}
                name="view"
                value={o.v}
                className={`flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors ${current === o.v ? "bg-linen" : "hover:bg-linen/60"}`}
              >
                <span className="text-[14px]">{o.label}</span>
                <span className="text-[11px] text-stone">{o.sub}</span>
              </button>
            ))}
          </form>
        </div>
      )}
    </div>
  );
}
