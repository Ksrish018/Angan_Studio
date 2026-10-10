import Link from "next/link";
type Band = { start: number; end: number };

const label = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

// Calls by hour (IST). Front desk hours are a shaded band, so calls outside it read as "would have been missed".
export function HourChart({ data, band }: { data: { hour: number; n: number }[]; band: Band }) {
  const counts = Array.from({ length: 24 }, (_, h) => data.find((d) => d.hour === h)?.n ?? 0);
  const max = Math.max(1, ...counts);
  return (
    <figure>
      <div className="relative flex h-40 items-end gap-[2px]" role="img" aria-label="Calls by hour of day, front desk hours shaded">
        <div
          aria-hidden
          className="absolute inset-y-0 rounded-md bg-[var(--band)]"
          style={{ left: `${(band.start / 24) * 100}%`, width: `${((band.end - band.start) / 24) * 100}%` }}
        />
        <span aria-hidden className="absolute top-2 text-[11px] text-stone" style={{ left: `calc(${(band.start / 24) * 100}% + 8px)` }}>
          Front desk hours
        </span>
        {counts.map((n, h) => (
          <div key={h} className="group relative z-10 flex h-full flex-1 items-end justify-center">
            <div
              className="anim-rise w-full max-w-[14px] rounded-t-[4px] bg-[var(--bar)] transition-colors group-hover:bg-[var(--bar-2)]"
              style={{ height: n ? `${(n / max) * 78}%` : 0, animationDelay: `${h * 25}ms` }}
            />
            <div className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-paper group-hover:block">
              {label(h)}–{label((h + 1) % 24)} · {n} call{n === 1 ? "" : "s"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-stone tabular" aria-hidden>
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{label(h)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Calls by hour</caption>
        <tbody>
          {counts.map((n, h) => (
            <tr key={h}><th>{label(h)}</th><td>{n}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function BarList({ data, empty }: { data: { label: string; n: number }[]; empty: string }) {
  if (!data.length) return <p className="text-[14px] text-stone">{empty}</p>;
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <ul className="space-y-3.5">
      {data.map((d, i) => (
        <li key={d.label} className="group">
          <div className="mb-1.5 flex justify-between text-[13px]">
            <span className="text-ink-2">{d.label}</span>
            <span className="tabular text-ink">{d.n}</span>
          </div>
          <div className="h-[6px] rounded-full bg-hairline-2">
            <div className="anim-grow h-full rounded-full bg-stone/70 transition-colors group-hover:bg-stone" style={{ width: `${(d.n / max) * 100}%`, animationDelay: `${i * 80}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const DOT: Record<string, string> = {
  qualified: "bg-sage",
  needs_info: "bg-ochre",
  declined: "bg-stone",
  escalation: "bg-rose-ink",
  missed: "bg-terracotta",
};

// One day of calls on a 24-hour line. Each dot opens that enquiry.
export function DayStrip({ calls, band }: { calls: { id: number; name: string | null; outcome: string; hour: number; after_hours: boolean }[]; band: Band }) {
  return (
    <div>
      <div className="relative h-14">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-hairline" />
        <div
          aria-hidden
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--band)]"
          style={{ left: `${(band.start / 24) * 100}%`, width: `${((band.end - band.start) / 24) * 100}%` }}
        />
        {calls.map((c, i) => (
          <Link
            key={c.id}
            href={`/leads/${c.id}`}
            title={`${c.name ?? "Unknown caller"} · ${label(Math.floor(c.hour))}`}
            className="group anim-fade-up absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-2"
            style={{ left: `${(c.hour / 24) * 100}%`, animationDelay: `${i * 90}ms` }}
          >
            <span className={`block h-3 w-3 rounded-full ring-2 ring-paper transition-transform group-hover:scale-150 ${DOT[c.outcome] ?? "bg-stone"}`} />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-paper group-hover:block">
              {c.name ?? "Unknown caller"}
            </span>
          </Link>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-stone tabular" aria-hidden>
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{label(h)}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sage" />Booked</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ochre" />Needs one answer</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-stone" />Not a fit</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-ink" />Escalated</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-terracotta" />Missed</span>
      </div>
    </div>
  );
}

// ---------- Pipeline funnel ----------
// One hue, bars shrink with each stage; the percentage is the step-to-step conversion.
export function Funnel({ stages }: { stages: { label: string; note: string; n: number }[] }) {
  const max = Math.max(1, stages[0]?.n ?? 0);
  const empty = (stages[0]?.n ?? 0) === 0;
  return (
    <ol className="space-y-3" aria-label="Enquiry pipeline">
      {stages.map((s, i) => {
        const prev = i ? stages[i - 1].n : null;
        const conv = prev ? Math.round((s.n / prev) * 100) : null;
        return (
          <li key={s.label} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[180px_minmax(0,1fr)_88px]">
            <div className="min-w-0">
              <p className="truncate text-[14px]">{s.label}</p>
              <p className="truncate text-[12px] text-stone">{s.note}</p>
            </div>
            <div className="order-3 col-span-2 h-9 rounded-[10px] bg-hairline-2 sm:order-none sm:col-span-1">
              <div
                className="anim-grow flex h-full items-center justify-end rounded-[10px] px-3 transition-opacity group-hover:opacity-90"
                style={{
                  width: empty ? `${100 - i * 15}%` : `${Math.max(s.n ? 6 : 0, (s.n / max) * 100)}%`,
                  background: empty ? "var(--hairline)" : "var(--bar)",
                  opacity: empty ? 1 : 1 - i * 0.12,
                  animationDelay: `${i * 90}ms`,
                }}
              >
                {!empty && s.n > 0 && <span className="text-[13px] tabular text-paper">{s.n}</span>}
              </div>
            </div>
            <p className="text-right text-[13px] tabular text-ink-2">
              {empty ? "—" : conv == null ? "100%" : `${conv}%`}
              {!empty && conv != null && <span className="block text-[11px] text-stone">of previous</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Calls per day, booked highlighted ----------
export function DailyColumns({ data }: { data: { day: string; calls: number; booked: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.calls));
  const fmt = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const total = data.reduce((s, d) => s + d.calls, 0);
  return (
    <figure>
      <div className="relative flex h-44 items-end gap-[3px]" role="img" aria-label="Calls per day, booked calls highlighted">
        {total === 0 && <p className="absolute inset-0 flex items-center justify-center text-[13px] text-stone">Calls will appear here day by day.</p>}
        {data.map((d, i) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="anim-rise flex w-full flex-col-reverse gap-[2px]" style={{ height: `${(d.calls / max) * 92}%`, animationDelay: `${i * 15}ms` }}>
              {d.booked > 0 && <div className="w-full rounded-t-[3px] bg-ink" style={{ flex: d.booked }} />}
              {d.calls - d.booked > 0 && <div className="w-full rounded-t-[3px] bg-[var(--bar)]" style={{ flex: d.calls - d.booked }} />}
            </div>
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-paper group-hover:block">
              {fmt(d.day)} · {d.calls} call{d.calls === 1 ? "" : "s"} · {d.booked} booked
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-stone tabular" aria-hidden>
        <span>{data[0] && fmt(data[0].day)}</span>
        <span>{data.at(-1) && fmt(data.at(-1)!.day)}</span>
      </div>
      <div className="mt-3 flex gap-5 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink" />Booked</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--bar)]" />Other calls</span>
      </div>
      <table className="sr-only">
        <caption>Calls per day</caption>
        <tbody>{data.map((d) => <tr key={d.day}><th>{d.day}</th><td>{d.calls} calls</td><td>{d.booked} booked</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

// ---------- Outcome mix: one proportional bar + labelled legend ----------
const MIX: { key: string; label: string; cls: string }[] = [
  { key: "qualified", label: "Booked", cls: "bg-sage" },
  { key: "needs_info", label: "Needs one answer", cls: "bg-ochre" },
  { key: "declined", label: "Not a fit", cls: "bg-stone" },
  { key: "escalation", label: "Escalated", cls: "bg-rose-ink" },
  { key: "missed", label: "Missed", cls: "bg-terracotta" },
];

export function OutcomeMix({ data }: { data: { outcome: string; n: number }[] }) {
  const total = data.reduce((s, d) => s + d.n, 0);
  const n = (k: string) => data.find((d) => d.outcome === k)?.n ?? 0;
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-full bg-hairline-2" role="img" aria-label="Share of calls by outcome">
        {total > 0 &&
          MIX.filter((m) => n(m.key) > 0).map((m, i) => (
            <div key={m.key} className={`anim-grow h-full ${m.cls}`} style={{ width: `${(n(m.key) / total) * 100}%`, animationDelay: `${i * 80}ms` }} title={`${m.label}: ${n(m.key)}`} />
          ))}
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
        {MIX.map((m) => (
          <li key={m.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-ink-2"><span className={`h-2.5 w-2.5 rounded-full ${m.cls}`} />{m.label}</span>
            <span className="tabular">{n(m.key)}{total ? <span className="text-stone"> · {Math.round((n(m.key) / total) * 100)}%</span> : null}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
