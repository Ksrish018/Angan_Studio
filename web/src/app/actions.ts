"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { viewer } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import { sendLeadHandoff } from "@/lib/pipeline";
import { cancelBooking } from "@/lib/integrations/calcom";
import { STARTER_TEAM } from "@/lib/starter-team";

export type FormState = { ok?: string; error?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------- Review queue ----------

const REVIEW: Record<string, { status: string; outcome?: string; note: string }> = {
  approve_decline: { status: "approved", note: "Agreed: not a fit" },
  overturn: { status: "overturned", outcome: "needs_info", note: "Overturned the decline. Will call back to book" },
  booked: { status: "resolved", outcome: "qualified", note: "Called back and booked a consultation" },
  not_fit: { status: "approved", outcome: "declined", note: "Called back: not a fit" },
  unreachable: { status: "pending", note: "Tried calling, no answer. Will retry" },
  resolved: { status: "resolved", note: "Spoke with the client. Resolved" },
  keep_booking: { status: "resolved", outcome: "qualified", note: "Kept the consultation the agent booked" },
  cancel_slot: { status: "approved", note: "Agreed: not a fit. Cancelled the slot the agent booked" },
  keep_designer: { status: "resolved", note: "Handover declined: the designer keeps this consultation" },
};

export async function reviewLead(formData: FormData) {
  const id = Number(formData.get("id"));
  const action = String(formData.get("action"));
  const extra = String(formData.get("note") ?? "").trim();
  const r = REVIEW[action];
  if (!id || !r) return;
  const user = await viewer();

  if (action === "cancel_slot") {
    const [row] = (await sql`select calcom_booking_uid from leads where id = ${id}`) as { calcom_booking_uid: string | null }[];
    try {
      if (row?.calcom_booking_uid) await cancelBooking(row.calcom_booking_uid, "Not the right fit for the studio right now");
      await sql`update leads set consultation_at = null, calcom_booking_uid = null, flags = array_remove(flags, 'slot_booked') where id = ${id}`;
    } catch (e) {
      // Leave it in the queue so nobody assumes the slot is gone.
      await sql`insert into lead_events (lead_id, actor, kind, note) values (${id}, ${user.name}, 'cancel_failed', ${`Couldn't cancel the slot in Cal.com, please cancel it there by hand. ${String(e).slice(0, 160)}`})`;
      revalidatePath("/", "layout");
      return;
    }
  }
  if (action === "keep_booking") await sql`update leads set flags = array_remove(flags, 'slot_booked') where id = ${id}`;
  if (r.status === "resolved") await sql`update leads set flags = array_remove(flags, 'handover') where id = ${id}`;

  await sql`update leads set review_status = ${r.status}, outcome = coalesce(${r.outcome ?? null}, outcome), updated_at = now() where id = ${id}`;
  await sql`insert into lead_events (lead_id, actor, kind, note) values (${id}, ${user.name}, ${action}, ${extra ? `${r.note}. ${extra}` : r.note})`;
  revalidatePath("/", "layout");
}

const CONSULTATION: Record<string, string> = {
  proposal_sent: "Consultation done. Proposal sent",
  not_a_fit: "Consultation done. Not a fit",
  no_show: "Client didn't show",
};

export async function setConsultationOutcome(formData: FormData) {
  const id = Number(formData.get("id"));
  const outcome = String(formData.get("outcome"));
  if (!id || !CONSULTATION[outcome]) return;
  const user = await viewer();
  await sql`update leads set consultation_outcome = ${outcome}, updated_at = now() where id = ${id}`;
  await sql`insert into lead_events (lead_id, actor, kind, note) values (${id}, ${user.name}, ${outcome}, ${CONSULTATION[outcome]})`;
  revalidatePath("/", "layout");
}

// ---------- Leads ----------

export async function reassignLead(formData: FormData) {
  const id = Number(formData.get("id"));
  const designerId = Number(formData.get("designer"));
  if (!id || !designerId) return;
  const user = await viewer();
  const [d] = (await sql`select name from designers where id = ${designerId} and active`) as { name: string }[];
  if (!d) return;
  const [l] = (await sql`
    update leads set designer_id = ${designerId}, handoff_emailed_at = null, updated_at = now(),
           review_status = case when 'handover' = any(flags) or 'no_designer' = any(flags) then 'resolved' else review_status end,
           flags = array_remove(array_remove(flags, 'handover'), 'no_designer')
    where id = ${id}
    returning outcome, (select source from calls c where c.id = leads.call_id) as source`) as { outcome: string; source: string }[];
  await sql`insert into lead_events (lead_id, actor, kind, note) values (${id}, ${user.name}, 'reassigned', ${`Reassigned to ${d.name}`})`;
  // Live leads get a fresh brief for the new designer. The September replay never sends email.
  if (l?.outcome === "qualified" && l.source === "vaani") await sendLeadHandoff(id);
  revalidatePath("/", "layout");
}

export async function requestHandover(formData: FormData) {
  const id = Number(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) return;
  const user = await viewer();
  await sql`update leads set flags = array_append(array_remove(flags, 'handover'), 'handover'), review_status = 'pending', updated_at = now() where id = ${id}`;
  await sql`insert into lead_events (lead_id, actor, kind, note) values (${id}, ${user.name}, 'handover', ${`Asked to hand this over${reason ? `: ${reason}` : ""}`})`;
  revalidatePath("/", "layout");
}

export async function deleteCaller(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id || String(formData.get("confirm")).trim().toUpperCase() !== "DELETE") return;
  // Deleting the call removes the lead, its timeline and costs (cascade). HubSpot records are separate.
  await sql`delete from calls where id = (select call_id from leads where id = ${id})`;
  revalidatePath("/", "layout");
  redirect("/leads");
}

// ---------- Team ----------

export async function addDesigner(_: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const specialty = String(formData.get("specialty") ?? "").trim() || null;
  const principal = formData.get("principal") === "on";
  if (name.length < 2) return { error: "Add the designer's name." };
  if (!EMAIL.test(email)) return { error: "That email doesn't look right." };
  const [existing] = (await sql`select id, active from designers where lower(email) = ${email}`) as { id: number; active: boolean }[];
  if (existing?.active) return { error: "This designer is already on the team." };
  if (existing) {
    await sql`update designers set name = ${name}, phone = ${phone}, specialty = ${specialty}, is_principal = ${principal},
              active = true, paused = false, is_demo = false where id = ${existing.id}`;
  } else {
    await sql`insert into designers (name, email, phone, specialty, is_principal, is_demo)
              values (${name}, ${email}, ${phone}, ${specialty}, ${principal}, false)`;
  }
  revalidatePath("/", "layout");
  return { ok: `${name} is on the team and will start receiving consultations.` };
}

export async function updateDesigner(formData: FormData) {
  const id = Number(formData.get("id"));
  const op = String(formData.get("op"));
  if (!id) return;
  if (op === "pause") await sql`update designers set paused = true where id = ${id}`;
  if (op === "resume") await sql`update designers set paused = false where id = ${id}`;
  if (op === "remove") await sql`update designers set active = false, paused = false where id = ${id}`;
  if (op === "principal") await sql`update designers set is_principal = not is_principal where id = ${id}`;
  if (op === "edit") {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (name.length >= 2) await sql`update designers set name = ${name} where id = ${id}`;
    if (EMAIL.test(email)) {
      const [taken] = (await sql`select id from designers where lower(email) = ${email} and id <> ${id}`) as { id: number }[];
      // A real address turns the placeholder into a real team member.
      if (!taken) await sql`update designers set email = ${email}, is_demo = ${email.endsWith("@example.com")} where id = ${id}`;
    }
  }
  revalidatePath("/", "layout");
}

// Brings back the starter roster (any removed starter designer is re-activated).
export async function loadStarterTeam() {
  for (const d of STARTER_TEAM) {
    await sql`insert into designers (name, email, is_principal, specialty, is_demo)
              values (${d.name}, ${d.email}, ${d.principal}, ${d.specialty}, true)
              on conflict (email) do update set active = true, paused = false`;
  }
  revalidatePath("/", "layout");
}

// ---------- Settings ----------

export async function saveStudioSettings(_: FormState, formData: FormData): Promise<FormState> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const int = (k: string, min: number, max: number) => {
    const n = Number(formData.get(k));
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
  };
  const officeStart = int("officeStart", 0, 23);
  const officeEnd = int("officeEnd", 1, 24);
  const retentionDays = int("retentionDays", 7, 3650);
  const perMin = Number(formData.get("vaaniInrPerMin"));
  const perCredit = str("vaaniInrPerCredit");
  const labels: Record<string, string> = { founderEmail: "founder", frontDeskEmail: "front desk", handoffInbox: "handoff inbox" };
  for (const k of Object.keys(labels)) {
    if (str(k) && !EMAIL.test(str(k))) return { error: `Check the ${labels[k]} email.` };
  }
  if (officeStart == null || officeEnd == null || officeEnd <= officeStart) return { error: "Office hours: the closing hour must be after the opening hour." };
  if (retentionDays == null) return { error: "Keep recordings for between 7 and 3650 days." };
  if (!Number.isFinite(perMin) || perMin < 0) return { error: "Voice cost per minute must be a number." };
  if (perCredit && !(Number(perCredit) >= 0)) return { error: "Cost per Vaani credit must be a number." };
  await saveSettings({
    officeStart, officeEnd, retentionDays,
    founderEmail: str("founderEmail"), frontDeskEmail: str("frontDeskEmail"), handoffInbox: str("handoffInbox"),
    seniorPhone: str("seniorPhone"), vaaniInrPerMin: perMin, vaaniInrPerCredit: perCredit ? Number(perCredit) : null,
  });
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

// Reset the dashboard: every call, enquiry, timeline entry, cost and connection log goes.
// The team and studio settings stay. HubSpot and Cal.com records live in those apps and are not touched.
export async function resetDashboard(_: FormState, formData: FormData): Promise<FormState> {
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "RESET") return { error: "Type RESET to confirm." };
  const [n] = (await sql`select (select count(*)::int from calls) as calls, (select count(*)::int from integration_log) as logs`) as { calls: number; logs: number }[];
  await sql`delete from calls`; // leads, timelines and costs go with their call
  await sql`delete from live_calls`;
  await sql`delete from integration_log`;
  await sql`delete from settings where left(key, 1) = '_'`; // background-job markers only, never studio settings
  let team = "Your team and settings are kept.";
  if (formData.get("placeholders") === "on") {
    await sql`delete from designers where is_demo`;
    team = "Placeholder designers removed; your real team and settings are kept.";
  }
  revalidatePath("/", "layout");
  return { ok: `Cleared ${n.calls} call${n.calls === 1 ? "" : "s"} and ${n.logs} log entr${n.logs === 1 ? "y" : "ies"}. ${team}` };
}
