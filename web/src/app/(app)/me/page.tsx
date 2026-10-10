import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";
import { myConsultations } from "@/lib/queries";
import { roomImage } from "@/lib/imagery";
import { PageHeader, when } from "@/components/ui";

const OUTCOME_LABEL: Record<string, string> = { proposal_sent: "Proposal sent", not_a_fit: "Not a fit", no_show: "No-show" };
const maps = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

export default async function MyConsultations() {
  const me = await viewer();
  if (me.role !== "designer" || !me.designerId) redirect("/");
  const rows = await myConsultations(me.designerId);

  const todays = rows.filter((r) => r.bucket === "today").reverse();
  const upcoming = rows.filter((r) => r.bucket === "upcoming").reverse();
  const past = rows.filter((r) => r.bucket === "past");

  const card = (r: (typeof rows)[number], big = false) => (
    <article key={r.id} className="reveal card group overflow-hidden">
      <Link href={`/leads/${r.id}`} className="block">
        <div className={`relative overflow-hidden ${big ? "aspect-[16/8]" : "aspect-[16/9]"}`}>
          <Image src={roomImage(r.property_type, r.project_kind, r.id)} alt="" fill sizes="(min-width:1024px) 600px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="text-[12px] uppercase tracking-[0.16em] text-white/80">
              {when(r.consultation_at, { weekday: "long", month: "long" })} · {r.consultation_mode === "site_visit" ? "Site visit" : r.consultation_mode === "studio" ? "At the studio" : "Mode to confirm"}
            </p>
            <p className={`mt-1 font-serif leading-tight ${big ? "text-[36px]" : "text-[28px]"}`}>{r.name ?? "New client"}</p>
            <p className="text-[14px] text-white/85">{[r.property_type, r.locality].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-2 p-4">
        <Link href={`/leads/${r.id}`} className="rounded-full bg-ink px-4 py-2 text-[13px] text-paper">Open brief</Link>
        {r.phone && <a href={`tel:${r.phone}`} className="rounded-full border border-hairline px-4 py-2 text-[13px]">Call client</a>}
        {r.locality && <a href={maps(r.locality)} target="_blank" rel="noreferrer" className="rounded-full border border-hairline px-4 py-2 text-[13px]">Directions</a>}
        {r.consultation_outcome && <span className="ml-auto rounded-full bg-sage-soft px-3 py-1 text-[12px] text-sage-ink">{OUTCOME_LABEL[r.consultation_outcome]}</span>}
        {r.flags.includes("handover") && <span className="ml-auto rounded-full bg-ochre-soft px-3 py-1 text-[12px] text-ochre-ink">Handover requested</span>}
      </div>
    </article>
  );

  return (
    <div className="wrap">
      <PageHeader eyebrow={`Hello, ${me.name.split(" ")[0]}`} title={todays.length ? `${todays.length} consultation${todays.length === 1 ? "" : "s"} today.` : "Your consultations."} />

      {rows.length === 0 && (
        <div className="card p-12 text-center text-[15px] text-stone">Nothing booked with you yet. New consultations appear here the moment Concierge books them.</div>
      )}

      {todays.length > 0 && (
        <section className="mb-14">
          <p className="eyebrow mb-4">Today</p>
          <div className="grid gap-5 lg:grid-cols-2">{todays.map((r) => card(r, true))}</div>
        </section>
      )}
      {upcoming.length > 0 && (
        <section className="mb-14">
          <p className="eyebrow mb-4">Coming up</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((r) => card(r))}</div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <p className="eyebrow">Done</p>
            <p className="text-[12px] text-stone">{past.filter((r) => !r.consultation_outcome).length} still need an outcome</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{past.map((r) => card(r))}</div>
        </section>
      )}
    </div>
  );
}
