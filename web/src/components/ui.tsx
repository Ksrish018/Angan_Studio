import Link from "next/link";

export const OUTCOME: Record<string, { label: string; cls: string }> = {
  qualified: { label: "Booked", cls: "bg-sage-soft text-sage-ink" },
  needs_info: { label: "Needs one answer", cls: "bg-ochre-soft text-ochre-ink" },
  declined: { label: "Not a fit", cls: "bg-mute-soft text-ink-2" },
  escalation: { label: "Escalated", cls: "bg-rose-soft text-rose-ink" },
  missed: { label: "Missed · call back", cls: "bg-terracotta-soft text-terracotta-ink" },
};

export const FLAG: Record<string, string> = {
  asked_price: "Asked about price",
  frustrated: "Frustrated",
  vip_referral: "Close referral",
  decider_unconfirmed: "Decider unconfirmed",
  not_booked: "No slot booked",
  slot_booked: "Agent booked a slot · check",
  handover: "Designer asked to hand over",
  no_designer: "No designer available",
};

export function OutcomePill({ outcome }: { outcome: string }) {
  const o = OUTCOME[outcome] ?? { label: outcome, cls: "bg-mute-soft text-ink-2" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] ${o.cls}`}>{o.label}</span>;
}

// Terracotta marks every place a person, not the AI, makes the call.
export function HumanTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-soft px-2.5 py-1 text-[12px] text-terracotta-ink">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-terracotta" />
      {children}
    </span>
  );
}

export function FlagTag({ flag }: { flag: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-hairline px-2.5 py-1 text-[12px] text-ink-2">
      {FLAG[flag] ?? flag}
    </span>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-4 pt-14 md:pt-20">
      <div className="anim-fade-up">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="font-serif text-[44px] leading-[1.03] md:text-[64px]">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function RangeTabs({ current, base = "/" }: { current: string; base?: string }) {
  const opts = [
    ["7d", "7 days"],
    ["30d", "30 days"],
    ["all", "All time"],
  ];
  return (
    <div className="inline-flex rounded-full border border-hairline bg-paper p-1 text-[13px]">
      {opts.map(([v, l]) => (
        <Link
          key={v}
          href={`${base}?range=${v}`}
          className={`rounded-full px-3.5 py-1.5 transition-colors ${current === v ? "bg-ink text-paper" : "text-stone hover:text-ink"}`}
        >
          {l}
        </Link>
      ))}
    </div>
  );
}

export const inr = (n: number) =>
  n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₹${Math.round(n).toLocaleString("en-IN")}`;

export const when = (iso: string | null, opts: Intl.DateTimeFormatOptions = {}) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata", ...opts,
      })
    : "—";
