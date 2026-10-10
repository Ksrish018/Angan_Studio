import { deleteCaller, reassignLead, requestHandover, reviewLead, setConsultationOutcome } from "@/app/actions";
import { HumanTag } from "./ui";

const OPTIONS: Record<string, [string, string][]> = {
  declined: [["approve_decline", "Agree, not a fit"], ["overturn", "Overturn: call back"]],
  needs_info: [["booked", "Called back, booked"], ["not_fit", "Called back, not a fit"], ["unreachable", "No answer"]],
  missed: [["booked", "Called back, booked"], ["not_fit", "Called back, not a fit"], ["unreachable", "No answer"]],
  escalation: [["resolved", "Spoke to client, resolved"]],
  qualified: [["resolved", "Followed up, all good"]],
};

// When the agent booked a slot the checks disagree with, the choice is keep it or cancel it.
const SLOT_OPTIONS: [string, string][] = [["keep_booking", "Keep the consultation"], ["cancel_slot", "Not a fit: cancel the slot"]];
// When a designer asks to hand over: reassign below, or keep it with them.
const HANDOVER_OPTIONS: [string, string][] = [["keep_designer", "Keep with this designer"]];

const btn = "rounded-full border border-hairline px-3.5 py-2 text-[13px] transition-colors hover:border-ink hover:bg-ink hover:text-paper";
const primary = `${btn} border-ink bg-ink text-paper hover:opacity-90`;
const input = "w-full rounded-lg border border-hairline bg-linen/50 px-3 py-2 text-[14px] outline-none placeholder:text-stone focus:border-stone";

export function ReviewActions({ id, outcome, slotBooked = false, handover = false }: { id: number; outcome: string; slotBooked?: boolean; handover?: boolean }) {
  const opts = slotBooked ? SLOT_OPTIONS : handover ? HANDOVER_OPTIONS : OPTIONS[outcome] ?? OPTIONS.qualified;
  return (
    <section className="card border-terracotta/40 p-6">
      <HumanTag>Your call</HumanTag>
      {handover && <p className="mt-3 text-[13px] text-stone">The designer asked to hand this over. Pick someone in Reassign, or keep it with them.</p>}
      <form action={reviewLead} className="mt-4">
        <input type="hidden" name="id" value={id} />
        <textarea name="note" rows={2} placeholder="Add a note (optional)" className={`${input} resize-none`} />
        <div className="mt-3 flex flex-wrap gap-2">
          {opts.map(([value, label], i) => (
            <button key={value} name="action" value={value} className={i === 0 ? primary : btn}>{label}</button>
          ))}
        </div>
      </form>
    </section>
  );
}

export function ConsultationOutcome({ id, current }: { id: number; current: string | null }) {
  const opts: [string, string][] = [["proposal_sent", "Proposal sent"], ["not_a_fit", "Not a fit"], ["no_show", "No-show"]];
  return (
    <section className="card p-6">
      <h2 className="font-serif text-[20px]">After the consultation</h2>
      <form action={setConsultationOutcome} className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="id" value={id} />
        {opts.map(([value, label]) => (
          <button key={value} name="outcome" value={value} className={current === value ? `${btn} border-sage bg-sage-soft text-sage-ink` : btn}>{label}</button>
        ))}
      </form>
    </section>
  );
}

export function ReassignForm({ id, current, team }: { id: number; current: number | null; team: { id: number; name: string }[] }) {
  return (
    <section className="card p-6">
      <h2 className="font-serif text-[20px]">Reassign</h2>
      <p className="mt-1 text-[13px] text-stone">The new designer gets the brief straight away.</p>
      <form action={reassignLead} className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="id" value={id} />
        <select name="designer" defaultValue={current ?? undefined} className={`${input} min-w-0 flex-1`} aria-label="Designer">
          {team.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className={primary}>Reassign</button>
      </form>
    </section>
  );
}

export function HandoverForm({ id, requested }: { id: number; requested: boolean }) {
  return (
    <section className="card p-6">
      <h2 className="font-serif text-[20px]">Can&rsquo;t take this one?</h2>
      {requested ? (
        <p className="mt-2 text-[13px] text-stone">You&rsquo;ve asked to hand this over. The front desk will reassign it.</p>
      ) : (
        <form action={requestHandover} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={id} />
          <input name="reason" placeholder="Reason (optional), e.g. on site that day" className={input} />
          <button className={btn}>Ask to hand over</button>
        </form>
      )}
    </section>
  );
}

export function DeleteCallerForm({ id }: { id: number }) {
  return (
    <details className="card p-6">
      <summary className="cursor-pointer list-none text-[13px] text-stone hover:text-rose-ink">Delete this caller&rsquo;s data…</summary>
      <form action={deleteCaller} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={id} />
        <p className="text-[13px] leading-relaxed text-stone">
          Removes the call, transcript, brief and timeline from Concierge for good (for data-deletion requests). HubSpot is separate.
        </p>
        <input name="confirm" placeholder="Type DELETE" className={input} autoComplete="off" />
        <button className="rounded-full border border-rose-ink px-3.5 py-2 text-[13px] text-rose-ink transition-colors hover:bg-rose-ink hover:text-paper">Delete permanently</button>
      </form>
    </details>
  );
}
