import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lead } from "@/lib/queries";
import type { Criteria, Verdict } from "@/lib/rules";
import { viewer } from "@/lib/auth";
import { indicativeRange, lakh, type Kind } from "@/knowledge/pricing";
import { MATERIALS, materialsFor, roomImage } from "@/lib/imagery";
import { FLAG, HumanTag, OutcomePill, when } from "@/components/ui";
import { ReviewActions, ConsultationOutcome, ReassignForm, HandoverForm, DeleteCallerForm } from "@/components/actions";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";

const CRITERIA: [keyof Criteria, string][] = [
  ["real_project", "Real project"],
  ["service_area", "In our area"],
  ["timeline", "Workable timeline"],
  ["budget", "Budget broadly fits"],
  ["decision_maker", "Decision-maker"],
];

const MARK: Record<Verdict, { glyph: string; cls: string; label: string }> = {
  pass: { glyph: "✓", cls: "bg-sage-soft text-sage-ink", label: "Meets" },
  fail: { glyph: "✕", cls: "bg-rose-soft text-rose-ink", label: "Does not meet" },
  unclear: { glyph: "?", cls: "bg-ochre-soft text-ochre-ink", label: "Unclear" },
};

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 text-[16px] leading-snug">{value || <span className="text-stone">Not captured</span>}</dd>
    </div>
  );
}

export default async function Brief({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const [l, me] = await Promise.all([lead(Number(id)), viewer()]);
  if (!l) notFound();
  // Designers only see their own clients.
  if (me.role === "designer" && l.designer_id !== me.designerId) redirect("/me");
  const team = me.role === "designer" ? [] : ((await sql`select id, name from designers where active and not paused order by name`) as { id: number; name: string }[]);

  const range = l.outcome === "qualified" ? indicativeRange(l.project_kind as Kind, l.carpet_sqft) : null;
  const humanFlags = l.flags.filter((f) => FLAG[f]);
  const turns = (l.transcript ?? "").split("\n").filter(Boolean);
  const palette = materialsFor(l.property_type, l.project_kind);

  return (
    <article>
      {/* Hero */}
      <section className="relative h-[62vh] min-h-[420px] overflow-hidden bg-hero">
        <Image src={roomImage(l.property_type, l.project_kind, l.id)} alt="" fill priority sizes="100vw" className="hero-drift object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 to-black/70" />
        <div className="hero-copy wrap relative flex h-full flex-col justify-between py-8 text-white">
          <Link href="/leads" className="self-start rounded-full bg-black/30 px-3.5 py-1.5 text-[13px] backdrop-blur-sm hover:bg-black/45">← Enquiries</Link>
          <div className="pb-6">
            <p className="anim-fade-up text-[12px] uppercase tracking-[0.2em] text-white/80">
              Called {when(l.started_at, { weekday: "short" })}{l.after_hours ? " · after hours" : ""}{l.source === "replay" ? " · September replay" : ""}
            </p>
            <h1 className="anim-fade-up mt-3 font-serif text-[52px] leading-[1.02] md:text-[88px]" style={{ animationDelay: "100ms" }}>{l.name ?? (l.outcome === "missed" ? "Silent caller" : "Unknown caller")}</h1>
            <p className="anim-fade-up mt-3 text-[17px] text-white/85 md:text-[19px]" style={{ animationDelay: "200ms" }}>
              {[l.property_type, l.locality].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <span className="absolute bottom-3 right-4 text-[11px] text-white/60">Illustrative image</span>
      </section>

      <div className="wrap">
        <div className="-mt-7 relative z-10 flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-hairline bg-paper px-6 py-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,.35)]">
          {l.outcome === "qualified" ? (
            <>
              <div>
                <p className="eyebrow">Consultation</p>
                <p className="mt-1 font-serif text-[26px]">{when(l.consultation_at, { weekday: "long", month: "long" })}</p>
              </div>
              <div className="text-[14px] sm:text-right">
                <p>{l.designer ?? "Designer to be assigned"}</p>
                <p className="text-stone">{l.consultation_mode === "site_visit" ? "Site visit" : l.consultation_mode === "studio" ? "At the studio" : "Mode to confirm"}</p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                {l.phone && <a href={`tel:${l.phone}`} className="rounded-full bg-ink px-4 py-2 text-[13px] text-paper">Call client</a>}
                {l.locality && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.locality)}`} target="_blank" rel="noreferrer" className="rounded-full border border-hairline px-4 py-2 text-[13px]">Directions</a>}
              </div>
            </>
          ) : (
            <p className="text-[15px] text-ink-2">
              {l.outcome === "declined" && `Kindly declined: ${l.decline_reason}. The front desk reviews every decline.`}
              {l.outcome === "needs_info" && "One answer is missing. The front desk will call back to ask."}
              {l.outcome === "escalation" && "Existing client with an issue. A senior person calls back within 15 minutes."}
              {l.outcome === "missed" && `The caller rang but didn't speak. The front desk will call back${l.phone ? ` on ${l.phone}` : ""}.`}
              {l.flags.includes("slot_booked") && ` The agent had already booked ${when(l.consultation_at, { weekday: "short" })}${l.designer ? ` with ${l.designer}` : ""}, so the front desk decides whether to keep it.`}
            </p>
          )}
          <OutcomePill outcome={l.outcome} />
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <section className="reveal card p-7">
              <h2 className="font-serif text-[26px]">The brief</h2>
              <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-6">
                <Fact label="Size" value={l.carpet_sqft ? `${l.carpet_sqft.toLocaleString("en-IN")} sq ft carpet` : null} />
                <Fact label="Timeline" value={l.timeline} />
                <div className="col-span-2"><Fact label="Scope" value={l.scope} /></div>
                <Fact label="Decides" value={l.decision_maker} />
                <Fact label="Came via" value={l.source_text} />
                {l.budget_volunteered && <Fact label="Budget (caller's own words)" value={l.budget_volunteered} />}
                {l.phone && <Fact label="Phone" value={l.phone} />}
              </dl>
              <div className="mt-8 border-t border-hairline-2 pt-6">
                <p className="eyebrow mb-3">From the call</p>
                <p className="text-[16px] leading-relaxed">{l.summary}</p>
                {l.designer_notes && <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{l.designer_notes}</p>}
              </div>
              {humanFlags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">{humanFlags.map((f) => <HumanTag key={f}>{FLAG[f]}</HumanTag>)}</div>
              )}
              {l.flags.includes("asked_price") && (
                <p className="mt-4 text-[13px] italic text-stone">Pricing is yours to discuss at the consultation. No figures were shared on the call.</p>
              )}
            </section>

            {["qualified", "needs_info"].includes(l.outcome) && (
              <section className="reveal card p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-serif text-[26px]">A starting palette</h2>
                  <span className="text-[12px] text-stone">For the first mood board · illustrative</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {palette.map((m) => (
                    <figure key={m} className="group">
                      <div className="relative aspect-square overflow-hidden rounded-2xl">
                        <Image src={`/materials/${m}.jpg`} alt={MATERIALS[m].name} fill sizes="200px" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                      </div>
                      <figcaption className="mt-2.5">
                        <span className="block text-[14px]">{MATERIALS[m].name}</span>
                        <span className="block text-[12px] text-stone">{MATERIALS[m].note}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )}

            <details className="reveal card group p-7">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-serif text-[26px]">Transcript</span>
                <span className="text-[13px] text-stone group-open:hidden">
                  {l.duration_sec ? `${Math.floor(l.duration_sec / 60)} min ${l.duration_sec % 60} s · ` : ""}Show
                </span>
              </summary>
              <div className="mt-6 space-y-3">
                {turns.map((t, i) => {
                  const agent = /^(\[[^\]]+\]\s*)?AGENT\b/.test(t);
                  const text = t.replace(/^(\[[^\]]+\]\s*)?(AGENT|USER)\s*[:|]\s*/, "");
                  return (
                    <div key={i} className={`flex ${agent ? "" : "justify-end"}`}>
                      <p className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${agent ? "bg-linen text-ink-2" : "bg-terracotta-soft text-ink"}`}>{text}</p>
                    </div>
                  );
                })}
              </div>
              {l.source === "replay" && <p className="mt-5 text-[12px] text-stone">Replayed from September&rsquo;s front desk transcript. Live calls show Concierge on the left.</p>}
            </details>
          </div>

          <aside className="space-y-5 lg:col-span-2">
            <section className="reveal card p-7">
              <h2 className="font-serif text-[26px]">Nikhil&rsquo;s five checks</h2>
              <ul className="mt-6 space-y-5">
                {CRITERIA.map(([key, label]) => {
                  const c = l.criteria[key];
                  const m = MARK[c.verdict];
                  return (
                    <li key={key} className="flex gap-3">
                      <span aria-label={m.label} className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] ${m.cls}`}>{m.glyph}</span>
                      <div>
                        <p className="text-[15px]">{label}</p>
                        <p className="text-[13px] leading-snug text-stone">{c.reason}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {range && me.role !== "front_desk" && (
              <section className="reveal card p-7">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-serif text-[22px]">For planning</h2>
                  <HumanTag>Internal only</HumanTag>
                </div>
                <p className="mt-4 font-serif text-[32px] tabular">{lakh(range.low)} – {lakh(range.high)}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-stone">{range.basis}, from the studio&rsquo;s indicative guide. Confirm on site. Never quote this before the consultation.</p>
              </section>
            )}

            {l.review_status === "pending" && me.role !== "designer" && (
              <ReviewActions id={l.id} outcome={l.outcome} slotBooked={l.flags.includes("slot_booked")} handover={l.flags.includes("handover")} />
            )}
            {l.outcome === "qualified" && <ConsultationOutcome id={l.id} current={l.consultation_outcome} />}
            {l.outcome === "qualified" && me.role !== "designer" && team.length > 0 && <ReassignForm id={l.id} current={l.designer_id} team={team} />}
            {l.outcome === "qualified" && me.role === "designer" && <HandoverForm id={l.id} requested={l.flags.includes("handover")} />}

            <section className="reveal card p-7">
              <h2 className="font-serif text-[22px]">Timeline</h2>
              <ol className="mt-5 space-y-4 border-l border-hairline pl-4">
                {l.events.map((e, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${e.actor === "concierge" || e.actor === "system" ? "bg-stone/60" : "bg-terracotta"}`} />
                    <p className="text-[13px] leading-snug">{e.note ?? e.kind}</p>
                    <p className="text-[12px] text-stone tabular">{when(e.at)} · {e.actor === "concierge" ? "Concierge" : e.actor === "system" ? "System" : e.actor}</p>
                  </li>
                ))}
              </ol>
            </section>
            {me.role === "founder" && <DeleteCallerForm id={l.id} />}
          </aside>
        </div>
      </div>
    </article>
  );
}
