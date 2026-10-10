import Image from "next/image";
import Link from "next/link";
import { leads, type LeadRow } from "@/lib/queries";
import { roomImage } from "@/lib/imagery";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";
import { FlagTag, OUTCOME, OutcomePill, PageHeader, when } from "@/components/ui";

export default async function Leads({ searchParams }: PageProps<"/leads">) {
  if ((await viewer()).role === "designer") redirect("/me");
  const sp = await searchParams;
  const outcome = typeof sp.outcome === "string" && OUTCOME[sp.outcome] ? sp.outcome : undefined;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const view = sp.view === "list" ? "list" : sp.view === "board" ? "board" : "gallery";
  const rows = await leads({ outcome, q });

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { outcome, q, view: view === "gallery" ? undefined : view, ...patch };
    for (const [key, v] of Object.entries(merged)) if (v) p.set(key, v);
    const s = p.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  const tab = (value: string | undefined, label: string) => (
    <Link
      key={label}
      href={qs({ outcome: value })}
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${outcome === value ? "bg-ink text-paper" : "text-stone hover:text-ink"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="wrap">
      <PageHeader eyebrow="Enquiries" title="Everyone who called." />
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-full border border-hairline bg-paper p-1">
          {tab(undefined, "All")}
          {Object.entries(OUTCOME).map(([v, o]) => tab(v, o.label))}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <form className="flex-1 sm:w-64">
            {outcome && <input type="hidden" name="outcome" value={outcome} />}
            {view !== "gallery" && <input type="hidden" name="view" value={view} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, area or scope"
              className="w-full rounded-full border border-hairline bg-paper px-4 py-2 text-[14px] outline-none placeholder:text-stone focus:border-stone"
            />
          </form>
          <div className="inline-flex rounded-full border border-hairline bg-paper p-1 text-[12px]">
            <Link href={qs({ view: undefined })} className={`rounded-full px-3 py-1.5 ${view === "gallery" ? "bg-ink text-paper" : "text-stone"}`}>Gallery</Link>
            <Link href={qs({ view: "board" })} className={`rounded-full px-3 py-1.5 ${view === "board" ? "bg-ink text-paper" : "text-stone"}`}>Board</Link>
            <Link href={qs({ view: "list" })} className={`rounded-full px-3 py-1.5 ${view === "list" ? "bg-ink text-paper" : "text-stone"}`}>List</Link>
          </div>
        </div>
      </div>

      {rows.length === 0 && <div className="card p-12 text-center text-[14px] text-stone">No enquiries match.</div>}

      {view === "board" && rows.length > 0 && <Board rows={rows} />}

      {view === "board" ? null : view === "gallery" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`} className="reveal card group overflow-hidden">
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={roomImage(l.property_type, l.project_kind, l.id)}
                  alt=""
                  fill
                  sizes="(min-width:1024px) 400px, (min-width:640px) 50vw, 100vw"
                  className={`object-cover transition-transform duration-700 group-hover:scale-105 ${l.outcome === "declined" ? "grayscale-[60%]" : ""}`}
                />
                <div className="absolute left-3 top-3"><OutcomePill outcome={l.outcome} /></div>
                {l.after_hours && <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm">After hours</span>}
              </div>
              <div className="p-5">
                <p className="font-serif text-[22px] leading-snug">{l.name ?? "Unknown caller"}</p>
                <p className="mt-1 truncate text-[14px] text-ink-2">{[l.property_type, l.carpet_sqft ? `${l.carpet_sqft.toLocaleString("en-IN")} sq ft` : null].filter(Boolean).join(" · ") || "Details not captured"}</p>
                <p className="truncate text-[13px] text-stone">{l.locality ?? "Location not given"}</p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-hairline-2 pt-3 text-[12px] text-stone">
                  <span className="truncate">
                    {l.outcome === "qualified"
                      ? `${l.designer ?? "Designer"} · ${when(l.consultation_at, { weekday: "short" })}`
                      : l.decline_reason ?? (l.outcome === "escalation" ? "Senior lead calling back" : "Front desk follow-up")}
                  </span>
                  {l.flags.includes("asked_price") && <FlagTag flag="asked_price" />}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        rows.length > 0 && (
          <div className="card overflow-hidden">
            <ul className="divide-y divide-hairline-2">
              {rows.map((l) => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="grid gap-2 px-5 py-4 transition-colors hover:bg-linen/60 md:grid-cols-[1.3fr_1.5fr_1fr_250px] md:items-center md:gap-6 md:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-[15px]">{l.name ?? "Unknown caller"}</p>
                      <p className="text-[12px] text-stone tabular">{when(l.started_at)}{l.after_hours && " · after hours"}</p>
                    </div>
                    <div className="min-w-0 text-[13px] text-ink-2">
                      <p className="truncate">{[l.property_type, l.carpet_sqft ? `${l.carpet_sqft.toLocaleString("en-IN")} sq ft` : null].filter(Boolean).join(" · ") || "—"}</p>
                      <p className="truncate text-stone">{l.locality ?? "Location not given"}</p>
                    </div>
                    <div className="text-[13px] text-ink-2">
                      {l.outcome === "qualified" ? (
                        <><p>{l.designer}</p><p className="text-stone tabular">{when(l.consultation_at, { weekday: "short" })}</p></>
                      ) : (
                        <p className="text-stone">{l.decline_reason ?? (l.outcome === "escalation" ? "Senior lead" : "Front desk follow-up")}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {l.flags.includes("asked_price") && <FlagTag flag="asked_price" />}
                      <OutcomePill outcome={l.outcome} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}

// Pipeline board: every enquiry as a card in its stage.
const COLUMNS: { key: string; title: string; note: string; match: (l: LeadRow) => boolean }[] = [
  { key: "callback", title: "Call back", note: "Missed or one answer missing", match: (l) => l.outcome === "missed" || l.outcome === "needs_info" },
  { key: "booked", title: "Consultation booked", note: "Waiting for the visit", match: (l) => l.outcome === "qualified" && !l.consultation_outcome },
  { key: "proposal", title: "Proposal sent", note: "Follow up in HubSpot", match: (l) => l.consultation_outcome === "proposal_sent" },
  { key: "closed", title: "Not going ahead", note: "Declined, not a fit, no-show", match: (l) => l.outcome === "declined" || (!!l.consultation_outcome && l.consultation_outcome !== "proposal_sent") },
  { key: "escalated", title: "Existing clients", note: "Complaints for the senior lead", match: (l) => l.outcome === "escalation" },
];

function Board({ rows }: { rows: LeadRow[] }) {
  return (
    <div className="no-scrollbar -mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-4 md:-mx-10 md:px-10">
      {COLUMNS.map((c) => {
        const items = rows.filter(c.match);
        return (
          <section key={c.key} className="w-[280px] shrink-0 snap-start rounded-[18px] bg-linen/60 p-3 shadow-[inset_0_0_0_1px_var(--hairline)]">
            <div className="flex items-baseline justify-between px-2 pb-3 pt-1">
              <div>
                <h2 className="text-[14px]">{c.title}</h2>
                <p className="text-[11px] text-stone">{c.note}</p>
              </div>
              <span className="rounded-full bg-paper px-2 py-0.5 text-[12px] tabular text-ink-2">{items.length}</span>
            </div>
            <ul className="space-y-2">
              {items.length === 0 && <li className="rounded-xl border border-dashed border-hairline px-3 py-6 text-center text-[12px] text-stone">Nothing here</li>}
              {items.map((l) => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="card block p-3 transition-colors hover:border-stone">
                    <p className="truncate text-[14px]">{l.name ?? (l.outcome === "missed" ? "Silent caller" : "Unknown caller")}</p>
                    <p className="truncate text-[12px] text-stone">{[l.property_type, l.locality?.split(",")[0]].filter(Boolean).join(" · ") || "Details not captured"}</p>
                    <p className="mt-2 text-[11px] text-ink-2 tabular">
                      {l.consultation_at ? `${l.designer ?? "Designer"} · ${when(l.consultation_at, { weekday: "short" })}` : when(l.started_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
