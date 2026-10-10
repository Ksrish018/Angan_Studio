"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Result = { href: string; title: string; sub: string; kind: string };

const PAGES: Result[] = [
  { href: "/", title: "Overview", sub: "Today at a glance", kind: "Page" },
  { href: "/leads", title: "Enquiries", sub: "Everyone who called", kind: "Page" },
  { href: "/review", title: "Review", sub: "Waiting for a person", kind: "Page" },
  { href: "/designers", title: "Designers", sub: "Roster and load", kind: "Page" },
];

export function SearchButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("open-palette"))}
      className="flex w-full items-center justify-between rounded-lg border border-hairline bg-paper px-3 py-2 text-[13px] text-stone transition-colors hover:text-ink"
    >
      Search
      <kbd className="rounded border border-hairline px-1.5 text-[11px]">Ctrl K</kbd>
    </button>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>(PAGES);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") { setOpen(false); setQ(""); setActive(0); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-palette", onOpen); };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) { setResults((await res.json()).results); setActive(0); }
      } catch { /* aborted */ }
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  if (!open) return null;
  const shown = q.trim().length < 2 ? PAGES.filter((p) => p.title.toLowerCase().includes(q.toLowerCase())) : results;
  const close = () => { setOpen(false); setQ(""); setResults(PAGES); setActive(0); };
  const go = (r: Result) => { close(); router.push(r.href); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[14vh] backdrop-blur-[2px]" onClick={close}>
      <div className="card anim-fade-up w-full max-w-lg overflow-hidden shadow-[0_24px_80px_-24px_rgba(0,0,0,.45)]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && shown[active]) go(shown[active]);
          }}
          placeholder="Search callers, areas, designers…"
          className="w-full border-b border-hairline bg-transparent px-5 py-4 text-[16px] outline-none placeholder:text-stone"
        />
        <ul className="max-h-80 overflow-y-auto py-2">
          {shown.length === 0 && <li className="px-5 py-6 text-center text-[14px] text-stone">No matches</li>}
          {shown.map((r, i) => (
            <li key={r.href + r.title}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center justify-between gap-4 px-5 py-2.5 text-left ${i === active ? "bg-linen" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px]">{r.title}</span>
                  {r.sub && <span className="block truncate text-[12px] text-stone">{r.sub}</span>}
                </span>
                <span className="eyebrow shrink-0">{r.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
