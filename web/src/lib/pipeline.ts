import { sql } from "./db";
import { extract, type Extraction } from "./extract";
import { decide, scrubPrice } from "./rules";
import { llmCost, voiceCost } from "./costs";
import { getSettings, isAfterHours, type Settings } from "./settings";
import { alertFounder, logIntegration, withRetry } from "./ops";
import { findBookingForCall } from "./integrations/calcom";
import { syncLead } from "./integrations/hubspot";
import { sendHandoff, fmtSlot } from "./integrations/email";

export type CallInput = {
  source: "vaani" | "replay";
  vaaniCallId?: string;
  transcript: string;
  startedAt: Date;
  endedAt?: Date;
  durationSec: number;
  answerSec?: number;
  fromNumber?: string | null;
  recordingUrl?: string | null;
  vaaniSummary?: string | null;
  endReason?: string | null;
  credits?: number | null;
  raw?: unknown;
  sideEffects: boolean; // send email + sync CRM (off for the September replay)
  lookupBooking?: typeof findBookingForCall; // swappable for tests
};

// True when the caller said something. Vaani lines look like "[00:00:05] USER: text".
export function callerSpoke(transcript: string) {
  return /(^|\]\s*)USER\s*[:|]\s*\S/m.test(transcript);
}

const unclear = (reason: string) => ({ verdict: "unclear", reason }) as const;
const allUnclear = (reason: string) => ({
  real_project: unclear(reason), service_area: unclear(reason), timeline: unclear(reason), budget: unclear(reason), decision_maker: unclear(reason),
});

type Designer = { id: number; name: string; email: string; is_principal: boolean };

async function pickDesigner(vip: boolean): Promise<Designer | null> {
  const rows = (await sql`
    select d.id, d.name, d.email, d.is_principal,
           count(l.id) filter (where l.consultation_at > now() - interval '60 days') as load
    from designers d left join leads l on l.designer_id = d.id
    where d.active and not d.paused
    group by d.id
    order by ${vip} and d.is_principal desc, load asc, random()
    limit 1`) as Designer[];
  return rows[0] ?? null;
}

// Replay only: the first open weekday slot two days after the call (11:00 or 15:00 IST).
function replaySlot(callAt: Date, n: number) {
  const d = new Date(callAt.getTime() + 2 * 86_400_000);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  const hourIst = n % 2 ? 15 : 11;
  // IST is UTC+5:30, so 11:00 IST = 05:30 UTC.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hourIst - 6, 30));
}

export async function event(leadId: number, actor: string, kind: string, note?: string, at?: Date) {
  await sql`insert into lead_events (lead_id, actor, kind, note, at) values (${leadId}, ${actor}, ${kind}, ${note ?? null}, ${(at ?? new Date()).toISOString()})`;
}

async function insertCall(input: CallInput, endedAt: Date, s: Settings) {
  const rows = (await sql`
    insert into calls (vaani_call_id, source, from_number, started_at, ended_at, duration_sec, answer_sec, after_hours,
                       transcript, summary, recording_url, end_reason, raw)
    values (${input.vaaniCallId ?? null}, ${input.source}, ${input.fromNumber ?? null}, ${input.startedAt.toISOString()},
            ${endedAt.toISOString()}, ${input.durationSec}, ${input.answerSec ?? null}, ${isAfterHours(input.startedAt, s)},
            ${input.transcript}, ${input.vaaniSummary ?? null}, ${input.recordingUrl ?? null}, ${input.endReason ?? null},
            ${input.raw ? JSON.stringify(input.raw) : null})
    on conflict (vaani_call_id) do nothing
    returning id`) as { id: number }[];
  return rows[0]?.id ?? null;
}

// A lead that a person must look at, used when there's nothing (or nothing reliable) to analyse.
async function humanOnlyLead(callId: number, input: CallInput, endedAt: Date, s: Settings, outcome: "missed" | "needs_info", summary: string, note: string) {
  const [row] = (await sql`
    insert into leads (call_id, phone, outcome, criteria, flags, summary, review_status, created_at)
    values (${callId}, ${input.fromNumber ?? null}, ${outcome}, ${JSON.stringify(allUnclear(summary))}, '{}', ${summary}, 'pending', ${endedAt.toISOString()})
    returning id`) as { id: number }[];
  await event(row.id, "concierge", "answered", `Answered${isAfterHours(input.startedAt, s) ? " · after hours" : ""}`, input.startedAt);
  await event(row.id, "concierge", outcome, note, endedAt);
  return { leadId: row.id, outcome };
}

export async function processCall(input: CallInput): Promise<{ leadId: number; outcome: string } | { duplicate: true }> {
  const s = await getSettings();
  const endedAt = input.endedAt ?? new Date(input.startedAt.getTime() + input.durationSec * 1000);

  const callId = await insertCall(input, endedAt, s);
  if (!callId) return { duplicate: true };

  const voice = voiceCost(input.durationSec, input.credits, s);
  await sql`insert into cost_events (call_id, vendor, units, unit, inr, estimated, at)
            values (${callId}, 'vaani', ${voice.units}, ${voice.unit}, ${voice.inr}, ${voice.estimated}, ${endedAt.toISOString()})`;

  // Hung up or stayed silent: nothing to analyse, but someone must call back.
  if (!callerSpoke(input.transcript)) {
    return humanOnlyLead(callId, input, endedAt, s, "missed",
      "The caller hung up or stayed silent before saying anything. Call them back.",
      "Caller didn't speak. Sent to front desk to call back");
  }

  // Read the call. If Gemini fails twice, a person reads it instead: no call is ever dropped.
  let x: Extraction;
  try {
    const res = await withRetry("gemini", "extract", () => extract(input.transcript, input.startedAt));
    x = res.data;
    const llm = llmCost(res.inputTokens, res.outputTokens);
    await sql`insert into cost_events (call_id, vendor, units, unit, inr, estimated, at)
              values (${callId}, 'gemini', ${llm.units}, ${llm.unit}, ${llm.inr}, true, ${endedAt.toISOString()})`;
  } catch {
    if (input.sideEffects) await alertFounder("A call couldn't be analysed", "Gemini didn't respond, so the call went to the review queue for a person to read.");
    return humanOnlyLead(callId, input, endedAt, s, "needs_info",
      input.vaaniSummary ?? "Concierge couldn't analyse this call automatically. Please read the transcript and call back.",
      "Couldn't analyse automatically. Sent to front desk");
  }

  const d = decide(x);
  const summary = scrubPrice(x.summary);
  const notes = scrubPrice(x.designer_notes);

  let designer: Designer | null = null;
  let consultationAt: Date | null = null;
  let bookingUid: string | null = null;

  // Look for the slot Vaani's agent booked, whatever our checks decided: the agent and the rules can disagree.
  if (input.source === "vaani") {
    const lookup = input.lookupBooking ?? findBookingForCall;
    const booking = await lookup({ phone: input.fromNumber, name: x.name, callEnded: endedAt })
      .then(async (b) => { await logIntegration("calcom", true, b ? "booking found" : "no booking for this call"); return b; })
      .catch(async (e) => { await logIntegration("calcom", false, `booking lookup: ${String(e)}`); return null; });
    if (booking) {
      consultationAt = new Date(booking.start);
      bookingUid = booking.uid;
      const host = booking.hosts?.[0]?.email;
      if (host) designer = ((await sql`select id, name, email, is_principal from designers where lower(email) = lower(${host})`) as Designer[])[0] ?? null;
    }
  }
  if (d.outcome === "qualified") {
    if (input.source === "replay") consultationAt = replaySlot(input.startedAt, callId);
    designer ??= await pickDesigner(x.flags.includes("vip_referral"));
  }

  const flags = [...d.flags];
  if (d.outcome === "qualified" && input.source === "vaani" && !bookingUid) flags.push("not_booked");
  // Nobody on the team is taking consultations (all paused, or none added yet): a person must assign one.
  if (d.outcome === "qualified" && !designer) flags.push("no_designer");
  if (d.outcome !== "qualified" && bookingUid) flags.push("slot_booked");
  const needsReview = d.needsReview || ["not_booked", "slot_booked", "no_designer"].some((f) => flags.includes(f));

  const lead = (await sql`
    insert into leads (call_id, name, phone, locality, in_service_area, property_type, carpet_sqft, scope, project_kind,
                       timeline, weeks_to_deadline, decision_maker, source, budget_volunteered, is_existing_client,
                       outcome, decline_reason, criteria, flags, summary, designer_notes, designer_id, consultation_at,
                       consultation_mode, calcom_booking_uid, review_status, created_at)
    values (${callId}, ${x.name}, ${input.fromNumber ?? null}, ${x.locality}, ${d.inServiceArea}, ${x.property_type},
            ${x.carpet_sqft}, ${x.scope}, ${x.project_kind}, ${x.timeline}, ${x.weeks_to_deadline}, ${x.decision_maker},
            ${x.source}, ${x.budget_volunteered}, ${x.is_existing_client_issue}, ${d.outcome}, ${d.declineReason},
            ${JSON.stringify(d.criteria)}, ${flags}, ${summary}, ${notes}, ${designer?.id ?? null},
            ${consultationAt?.toISOString() ?? null}, ${x.consultation_mode === "unknown" ? null : x.consultation_mode},
            ${bookingUid}, ${needsReview ? "pending" : "none"}, ${endedAt.toISOString()})
    returning id`) as { id: number }[];
  const leadId = lead[0].id;

  await event(leadId, "concierge", "answered", `Answered${input.answerSec != null ? ` in ${input.answerSec}s` : ""}${isAfterHours(input.startedAt, s) ? " · after hours" : ""}`, input.startedAt);
  if (x.flags.includes("asked_price")) await event(leadId, "concierge", "price_deflected", "Asked about pricing. Gave the approved line, no figures.", endedAt);
  const outcomeNote: Record<string, string> = {
    qualified: designer ? `Qualified. Consultation with ${designer.name}, ${fmtSlot(consultationAt)}` : "Qualified",
    needs_info: "Needs one more answer. Sent to front desk",
    declined: `Declined kindly: ${d.declineReason}. Sent to front desk for review`,
    escalation: `Existing client issue. Escalated to senior lead${s.seniorPhone ? ` (${s.seniorPhone})` : ""}`,
  };
  await event(leadId, "concierge", d.outcome, outcomeNote[d.outcome], endedAt);
  if (flags.includes("slot_booked")) {
    await event(leadId, "concierge", "slot_conflict",
      `The agent booked ${fmtSlot(consultationAt)}${designer ? ` with ${designer.name}` : ""}, but the checks disagree. Front desk to keep or cancel`, endedAt);
  }

  if (input.sideEffects && d.outcome === "escalation") {
    await alertFounder("An existing client needs a call back", `${x.name ?? "A client"} called with an issue about an ongoing project. Senior lead to call back within 15 minutes.`);
  }
  if (input.sideEffects && d.outcome === "qualified") {
    await syncCrm(leadId);
    await sendLeadHandoff(leadId);
  }
  return { leadId, outcome: d.outcome };
}

type HandoffRow = {
  id: number; name: string | null; phone: string | null; locality: string | null; property_type: string | null; carpet_sqft: number | null;
  scope: string | null; timeline: string | null; decision_maker: string | null; source: string | null; consultation_at: string | null;
  consultation_mode: string | null; flags: string[]; summary: string | null; designer_notes: string | null;
  designer_name: string | null; designer_email: string | null; hubspot_deal_id: string | null;
};

async function loadHandoff(leadId: number) {
  const [l] = (await sql`
    select l.id, l.name, l.phone, l.locality, l.property_type, l.carpet_sqft, l.scope, l.timeline, l.decision_maker, l.source,
           l.consultation_at, l.consultation_mode, l.flags, l.summary, l.designer_notes, l.hubspot_deal_id,
           d.name as designer_name, d.email as designer_email
    from leads l left join designers d on d.id = l.designer_id where l.id = ${leadId}`) as HandoffRow[];
  return l ?? null;
}

// Creates the HubSpot contact + deal for a booked lead (retried; failures go to the review queue).
export async function syncCrm(leadId: number) {
  const l = await loadHandoff(leadId);
  if (!l || l.hubspot_deal_id) return;
  try {
    const crm = await withRetry("hubspot", `lead ${leadId}`, () => syncLead({
      name: l.name, phone: l.phone, locality: l.locality, summary: l.summary ?? "",
      consultationAt: l.consultation_at ? new Date(l.consultation_at) : null, propertyType: l.property_type,
    }));
    if (crm) {
      await sql`update leads set hubspot_contact_id = ${crm.contactId}, hubspot_deal_id = ${crm.dealId} where id = ${leadId}`;
      await event(leadId, "system", "crm_synced", "Contact and deal created in HubSpot");
    }
  } catch (e) {
    await event(leadId, "system", "crm_failed", `HubSpot didn't respond after 3 tries: ${String(e).slice(0, 200)}`);
    await alertFounder("HubSpot sync failed", `A booked lead couldn't be added to HubSpot after 3 tries. It's still safe in Concierge.`);
  }
}

// Emails the assigned designer the brief (retried; on failure the lead goes to the review queue and Nikhil is told).
export async function sendLeadHandoff(leadId: number) {
  const [l, s] = await Promise.all([loadHandoff(leadId), getSettings()]);
  if (!l || !l.designer_email || !l.designer_name) return;
  try {
    const res = await withRetry("resend", `handoff lead ${leadId}`, () => sendHandoff(
      {
        leadId, designerName: l.designer_name!, designerEmail: l.designer_email!, name: l.name, phone: l.phone, locality: l.locality,
        propertyType: l.property_type, carpetSqft: l.carpet_sqft, scope: l.scope, timeline: l.timeline, decisionMaker: l.decision_maker,
        source: l.source, consultationAt: l.consultation_at ? new Date(l.consultation_at) : null, consultationMode: l.consultation_mode,
        flags: l.flags, summary: l.summary ?? "", designerNotes: l.designer_notes,
      },
      process.env.APP_URL ?? "http://localhost:3000",
      { inbox: s.handoffInbox || undefined, cc: s.frontDeskEmail || undefined },
    ));
    await sql`update leads set handoff_emailed_at = now() where id = ${leadId}`;
    await event(leadId, "system", "handoff_sent", `Brief emailed to ${l.designer_name}${res.to !== l.designer_email ? ` (via ${res.to})` : ""}`);
  } catch (e) {
    await sql`update leads set review_status = 'pending' where id = ${leadId}`;
    await event(leadId, "system", "handoff_failed", `Brief email failed after 3 tries: ${String(e).slice(0, 200)}`);
    await alertFounder("A designer brief didn't send", `The brief for ${l.name ?? "a booked client"} couldn't be emailed to ${l.designer_name}. It's in the review queue.`);
  }
}
