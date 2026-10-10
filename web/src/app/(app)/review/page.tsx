import Link from "next/link";
import { reviewQueue } from "@/lib/queries";
import { FlagTag, OutcomePill, PageHeader, when } from "@/components/ui";
import { ReviewActions } from "@/components/actions";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";

function waiting(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? "just now" : h < 48 ? `${h}h waiting` : `${Math.floor(h / 24)} days waiting`;
}

const WHY: Record<string, string> = {
  declined: "Concierge said no kindly. Check you agree.",
  needs_info: "One answer was missing. Call back to ask.",
  escalation: "Existing client with an issue. Senior lead to call within 15 minutes.",
  qualified: "Fits, but needs a person: no slot booked, no designer free, or the caller was frustrated.",
  missed: "Rang but didn't speak, or hung up. Call them back.",
};

export default async function Review() {
  const me = await viewer();
  if (me.role === "designer") redirect("/me");
  const queue = await reviewQueue();

  return (
    <div className="wrap">
      <PageHeader eyebrow="Front desk" title={queue.length ? `${queue.length} need${queue.length === 1 ? "s" : ""} a person` : "All clear"} />
      <p className="-mt-6 mb-8 max-w-2xl text-[14px] leading-relaxed text-stone">
        Every decline, every unclear call and every complaint lands here. Aim to clear the list by 11am.
      </p>

      {queue.length === 0 && <div className="card p-12 text-center text-[15px] text-stone">Nothing waiting. Concierge has it handled.</div>}

      <div className="space-y-4">
        {queue.map((l) => (
          <div key={l.id} className={`reveal card grid gap-6 p-6 lg:grid-cols-[1fr_340px] ${l.outcome === "escalation" ? "border-rose-ink/40" : ""}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <OutcomePill outcome={l.outcome} />
                {l.flags.filter((f) => !["decider_unconfirmed", "slot_booked", "handover"].includes(f)).map((f) => <FlagTag key={f} flag={f} />)}
                <span className="ml-auto text-[12px] text-stone tabular">{waiting(l.started_at)}</span>
              </div>
              <Link href={`/leads/${l.id}`} className="mt-4 block font-serif text-[24px] font-light hover:text-terracotta">
                {l.name ?? (l.outcome === "missed" ? "Silent caller" : "Unknown caller")}
              </Link>
              <p className="text-[14px] text-ink-2">
                {[l.property_type, l.locality].filter(Boolean).join(" · ") || "Details not captured"} · {when(l.started_at)}
              </p>
              <p className="mt-4 text-[14px] font-medium">{l.decline_reason ? `${l.decline_reason}. ` : ""}{WHY[l.outcome]}</p>
              {l.flags.includes("slot_booked") && (
                <p className="mt-2 rounded-xl bg-ochre-soft px-3 py-2 text-[13px] text-ochre-ink">
                  The agent already booked {when(l.consultation_at, { weekday: "short" })}{l.designer ? ` with ${l.designer}` : ""}. Keep it, or cancel the slot.
                </p>
              )}
              {l.flags.includes("handover") && (
                <p className="mt-2 rounded-xl bg-ochre-soft px-3 py-2 text-[13px] text-ochre-ink">
                  {l.designer ?? "The designer"} asked to hand over the {when(l.consultation_at, { weekday: "short" })} consultation. <a href={`/leads/${l.id}`} className="underline underline-offset-4">Open to reassign</a>.
                </p>
              )}
              {l.outcome === "missed" && l.phone && <p className="mt-2 text-[14px]">Call back on <a href={`tel:${l.phone}`} className="underline underline-offset-4">{l.phone}</a></p>}
              <p className="mt-2 text-[14px] leading-relaxed text-stone">{l.summary}</p>
            </div>
            <ReviewActions id={l.id} outcome={l.outcome} slotBooked={l.flags.includes("slot_booked")} handover={l.flags.includes("handover")} />
          </div>
        ))}
      </div>
    </div>
  );
}
