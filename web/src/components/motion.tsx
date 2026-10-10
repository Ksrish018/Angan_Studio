"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Numbers count up gently on first view (skipped for reduced motion).
export function CountUp({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(value);
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !el.current) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / 1100);
        setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      // Background tabs throttle animation frames; always land on the real number.
      done = setTimeout(() => { cancelAnimationFrame(raf); setN(value); }, 1500);
    });
    let done: ReturnType<typeof setTimeout> | undefined;
    io.observe(el.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); clearTimeout(done); };
  }, [value]);
  return (
    <span ref={el} className="tabular">
      {prefix}{n.toLocaleString("en-IN")}{suffix}
    </span>
  );
}

export type Theme = "auto" | "linen" | "atelier" | "gallery" | "courtyard";
export const THEMES: { id: Theme; label: string; swatch: [string, string] }[] = [
  { id: "auto", label: "Auto", swatch: ["#f6f2ec", "#12100e"] },
  { id: "linen", label: "Studio Linen", swatch: ["#f6f2ec", "#b5552e"] },
  { id: "atelier", label: "Midnight Atelier", swatch: ["#12100e", "#e2bf7f"] },
  { id: "gallery", label: "Gallery White", swatch: ["#ffffff", "#2f6b4f"] },
  { id: "courtyard", label: "Courtyard", swatch: ["#f3e7d3", "#1f5f5b"] },
];
const THEME_EVENT = "theme-change";

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return THEMES.some((x) => x.id === t) ? (t as Theme) : "auto";
  } catch {
    return "auto";
  }
}
function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(THEME_EVENT, cb); window.removeEventListener("storage", cb); };
}

export function ThemePicker({ align = "right" }: { align?: "left" | "right" }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "auto" as Theme);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (t: Theme) => {
    const root = document.documentElement;
    try {
      if (t === "auto") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch { /* storage blocked: still switch for this visit */ }
    if (t === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
    window.dispatchEvent(new Event(THEME_EVENT));
    setOpen(false);
  };
  const current = THEMES.find((x) => x.id === theme)!;

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        className="flex items-center gap-2 rounded-full border border-hairline bg-paper/70 px-2.5 py-1.5 text-[12px] text-ink-2 transition-colors hover:text-ink"
      >
        <span className="flex">
          <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: current.swatch[0] }} />
          <span className="-ml-1.5 h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: current.swatch[1] }} />
        </span>
        <span className="hidden sm:inline">Theme</span>
      </button>
      {open && (
        <div className={`card anim-fade-up absolute top-full z-50 mt-2 w-60 p-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,.35)] ${align === "right" ? "right-0" : "left-0"}`}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => choose(t.id)}
              aria-pressed={theme === t.id}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors ${theme === t.id ? "bg-linen" : "hover:bg-linen/60"}`}
            >
              <span className="flex">
                <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: t.swatch[0] }} />
                <span className="-ml-2 h-5 w-5 rounded-full border border-black/10" style={{ background: t.swatch[1] }} />
              </span>
              <span className="flex-1">{t.label}</span>
              {theme === t.id && <span aria-hidden className="text-terracotta">●</span>}
            </button>
          ))}
          <p className="px-3 pb-1 pt-2 text-[11px] text-stone">Auto follows your device: Linen by day, Atelier at night.</p>
        </div>
      )}
    </div>
  );
}
