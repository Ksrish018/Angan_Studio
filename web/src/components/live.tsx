"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type Latest = {
  id: number; name: string | null; outcome: string; locality: string | null; property_type: string | null;
  consultation_at: string | null; designer: string | null;
};
type Live = { active: { id: string; started_at: string }[]; latest: Latest | null; pending: number };

const LiveContext = createContext<Live | null>(null);
export const useLive = () => useContext(LiveContext);

const POLL_MS = 15_000;

function toastCopy(l: Latest) {
  const who = l.name ?? "A new caller";
  if (l.outcome === "qualified" && l.designer) {
    const slot = l.consultation_at
      ? new Date(l.consultation_at).toLocaleString("en-IN", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })
      : "";
    return { title: `${who} booked with ${l.designer}`, sub: slot };
  }
  if (l.outcome === "escalation") return { title: `${who} needs a senior call back`, sub: "Existing client issue" };
  if (l.outcome === "missed") return { title: "A caller hung up without speaking", sub: "Front desk to call back" };
  if (l.outcome === "declined") return { title: `${who} wasn't a fit`, sub: "Front desk to review" };
  return { title: `${who} needs one more answer`, sub: "Front desk to follow up" };
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [live, setLive] = useState<Live | null>(null);
  const [toast, setToast] = useState<Latest | null>(null);
  const lastSeen = useRef<number | null>(null);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Live;
        if (stop) return;
        setLive(data);
        const id = data.latest?.id ?? null;
        if (lastSeen.current !== null && id !== null && id !== lastSeen.current) {
          setToast(data.latest);
          router.refresh();
        }
        lastSeen.current = id;
      } catch {
        /* offline: try again next tick */
      }
    }
    tick();
    const t = setInterval(tick, POLL_MS);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => { stop = true; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <LiveContext.Provider value={live}>
      {children}
      {toast && (
        <div role="status" className="anim-fade-up fixed bottom-5 right-5 z-50 w-[min(360px,calc(100vw-40px))]">
          <Link href={`/leads/${toast.id}`} onClick={() => setToast(null)} className="card flex items-start gap-3 p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,.25)]">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sage pulse-dot" />
            <span>
              <span className="block text-[14px]">{toastCopy(toast).title}</span>
              <span className="block text-[12px] text-stone">{toastCopy(toast).sub}</span>
            </span>
          </Link>
        </div>
      )}
    </LiveContext.Provider>
  );
}

function elapsed(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveStatus() {
  const live = useLive();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const call = live?.active[0];
  return (
    <div className="flex items-center gap-2 text-[12px] text-stone" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${call ? "bg-sage pulse-dot" : "bg-stone/40"}`} />
      {call ? (
        <span className="text-ink">
          On a call · <span className="tabular">{elapsed(call.started_at, now)}</span>
          {live!.active.length > 1 && ` (+${live!.active.length - 1})`}
        </span>
      ) : (
        <span>Listening for calls</span>
      )}
    </div>
  );
}

export function PendingBadge() {
  const live = useLive();
  if (!live?.pending) return null;
  return <span className="ml-auto rounded-full bg-terracotta-soft px-2 py-0.5 text-[11px] tabular text-terracotta-ink">{live.pending}</span>;
}
