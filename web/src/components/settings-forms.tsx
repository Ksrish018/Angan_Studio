"use client";

import { useActionState } from "react";
import { resetDashboard, saveStudioSettings, type FormState } from "@/app/actions";
import type { Settings } from "@/lib/settings";
import { field } from "./team-forms";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] leading-snug text-stone">{hint}</span>}
    </label>
  );
}

export function StudioSettingsForm({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveStudioSettings, {});
  return (
    <form action={action} className="card p-7">
      <h2 className="font-serif text-[26px]">Studio</h2>
      <p className="mt-1 text-[14px] text-stone">Who gets told what, and when the front desk is in.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Founder email" hint="Monday digest and alerts when something fails.">
          <input name="founderEmail" type="email" defaultValue={s.founderEmail} className={field} placeholder="nikhil@aanganstudio.in" />
        </Field>
        <Field label="Front desk email" hint="Copied on every designer brief.">
          <input name="frontDeskEmail" type="email" defaultValue={s.frontDeskEmail} className={field} placeholder="frontdesk@aanganstudio.in" />
        </Field>
        <Field label="Senior lead phone" hint="For existing-client escalations. Also set it as the transfer number in Vaani.">
          <input name="seniorPhone" type="tel" defaultValue={s.seniorPhone} className={field} placeholder="+91 98…" />
        </Field>
        <Field label="Send all briefs to (optional)" hint="Until Aangan's email domain is verified, Resend can only deliver to its account owner. Put that inbox here; leave empty once the domain is live.">
          <input name="handoffInbox" type="email" defaultValue={s.handoffInbox} className={field} placeholder="owner@…" />
        </Field>
        <Field label="Front desk opens (hour)">
          <input name="officeStart" type="number" min={0} max={23} defaultValue={s.officeStart} className={field} />
        </Field>
        <Field label="Front desk closes (hour)">
          <input name="officeEnd" type="number" min={1} max={24} defaultValue={s.officeEnd} className={field} />
        </Field>
        <Field label="Voice cost per minute (₹)" hint="Used for cost per booking until Vaani's credit rate is known.">
          <input name="vaaniInrPerMin" type="number" step="0.01" min={0} defaultValue={s.vaaniInrPerMin} className={field} />
        </Field>
        <Field label="Cost per Vaani credit (₹, optional)" hint="When set, actual credits from each call are used instead.">
          <input name="vaaniInrPerCredit" type="number" step="0.0001" min={0} defaultValue={s.vaaniInrPerCredit ?? ""} className={field} />
        </Field>
        <Field label="Keep transcripts and recordings (days)" hint="After this they're cleared automatically. The lead summary stays.">
          <input name="retentionDays" type="number" min={7} max={3650} defaultValue={s.retentionDays} className={field} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-[14px] text-paper transition-opacity hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.error && <p role="alert" className="text-[14px] text-rose-ink">{state.error}</p>}
        {state.ok && <p role="status" className="text-[14px] text-sage-ink">{state.ok}</p>}
      </div>
    </form>
  );
}

export type ResetCounts = { calls: number; leads: number; logs: number; placeholders: number };

export function ResetForm({ counts }: { counts: ResetCounts }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetDashboard, {});
  const empty = counts.calls === 0 && counts.logs === 0;
  return (
    <form action={action} className="card border-rose-ink/30 p-7">
      <h2 className="font-serif text-[26px]">Reset dashboard</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-stone">
        Starts the dashboard fresh: removes every call, enquiry, timeline, cost and connection log. Your team and studio settings stay.
        HubSpot and Cal.com records are kept in those apps. This can&apos;t be undone.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-hairline-2 py-4 text-center">
        <div><dt className="eyebrow">Calls</dt><dd className="mt-1 font-serif text-[24px] tabular">{counts.calls}</dd></div>
        <div><dt className="eyebrow">Enquiries</dt><dd className="mt-1 font-serif text-[24px] tabular">{counts.leads}</dd></div>
        <div><dt className="eyebrow">Log entries</dt><dd className="mt-1 font-serif text-[24px] tabular">{counts.logs}</dd></div>
      </dl>
      {counts.placeholders > 0 && (
        <label className="mt-4 flex items-start gap-3 text-[14px] leading-snug">
          <input type="checkbox" name="placeholders" className="mt-0.5 h-4 w-4 accent-[var(--color-rose-ink)]" />
          <span>Also remove the {counts.placeholders} placeholder designer{counts.placeholders === 1 ? "" : "s"}</span>
        </label>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input name="confirm" placeholder="Type RESET" className={`${field} max-w-[180px]`} autoComplete="off" />
        <button disabled={pending} className="rounded-full border border-rose-ink px-5 py-2.5 text-[14px] text-rose-ink transition-colors hover:bg-rose-ink hover:text-paper disabled:opacity-60">
          {pending ? "Resetting…" : empty ? "Reset anyway" : "Reset dashboard"}
        </button>
      </div>
      {state.error && <p role="alert" className="mt-3 text-[14px] text-rose-ink">{state.error}</p>}
      {state.ok && <p role="status" className="mt-3 text-[14px] text-sage-ink">{state.ok}</p>}
    </form>
  );
}
