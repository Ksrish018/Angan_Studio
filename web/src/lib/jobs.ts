import { Resend } from "resend";
import { sql } from "./db";
import { getMarker, getSettings, setMarker } from "./settings";
import { logIntegration } from "./ops";
import { processCall } from "./pipeline";
import { getCallTranscript, recentCalls } from "./integrations/vaani";

// 1. Recovery: a call Vaani reported (call_started / call_ended) but whose processed-call webhook never arrived.
export async function reconcile(): Promise<{ checked: number; recovered: number }> {
  const stale = (await sql`
    select lc.vaani_call_id as id, lc.started_at, lc.ended_at
    from live_calls lc
    where not exists (select 1 from calls c where c.vaani_call_id = lc.vaani_call_id)
      and ((lc.ended_at is not null and lc.ended_at < now() - interval '5 minutes')
        or (lc.ended_at is null and lc.started_at < now() - interval '40 minutes'))
    order by lc.started_at limit 20`) as { id: string; started_at: string; ended_at: string | null }[];
  if (!stale.length) return { checked: 0, recovered: 0 };

  let history: Awaited<ReturnType<typeof recentCalls>> = [];
  try { history = await recentCalls(200); } catch (e) { await logIntegration("vaani", false, `call-history: ${String(e)}`); }

  let recovered = 0;
  for (const c of stale) {
    const h = history.find((x) => x.call_id === c.id);
    const details = await getCallTranscript(c.id).catch(() => null);
    const ageMin = (Date.now() - new Date(c.started_at).getTime()) / 60_000;
    // Transcript not ready yet: try again on the next run, unless it's been two hours.
    if (!details && ageMin < 120) continue;
    const durationSec = Math.round((h?.duration_ms ?? 0) / 1000);
    await processCall({
      source: "vaani",
      vaaniCallId: c.id,
      transcript: details?.transcript ?? h?.call_transcription ?? "",
      startedAt: h?.Start_time ? new Date(h.Start_time) : new Date(c.started_at),
      endedAt: h?.End_time ? new Date(h.End_time) : c.ended_at ? new Date(c.ended_at) : undefined,
      durationSec,
      fromNumber: h?.from_number ?? null,
      vaaniSummary: details?.summary ?? h?.call_summary ?? null,
      credits: h?.call_cost ?? null,
      raw: { recovered: true, history: h ?? null },
      sideEffects: true,
    });
    recovered++;
  }
  await logIntegration("cron", true, `reconcile: ${stale.length} checked, ${recovered} recovered`);
  return { checked: stale.length, recovered };
}

// Runs reconciliation at most every 5 minutes, piggy-backing on dashboard activity (Vercel Hobby crons are daily).
export async function maybeReconcile() {
  const last = await getMarker("last_reconcile");
  if (last && Date.now() - new Date(last).getTime() < 5 * 60_000) return;
  await setMarker("last_reconcile", new Date().toISOString());
  await reconcile().catch((e) => logIntegration("cron", false, `reconcile: ${String(e)}`));
}

// 2. Privacy: clear transcripts, recordings and raw payloads after the retention period. The lead summary stays.
export async function retention(): Promise<number> {
  const s = await getSettings();
  const rows = (await sql`
    update calls set transcript = null, recording_url = null, raw = null
    where started_at < now() - make_interval(days => ${s.retentionDays}) and (transcript is not null or recording_url is not null or raw is not null)
    returning id`) as unknown[];
  await logIntegration("cron", true, `retention: cleared ${rows.length} calls older than ${s.retentionDays} days`);
  return rows.length;
}

// 3. The Monday digest for Nikhil.
export async function digestData() {
  const [k] = (await sql`
    select count(*)::int as calls,
           count(*) filter (where c.after_hours)::int as after_hours,
           count(l.id) filter (where l.outcome = 'qualified')::int as booked,
           count(l.id) filter (where l.outcome = 'declined')::int as declined,
           count(l.id) filter (where l.outcome = 'missed')::int as missed,
           count(l.id) filter (where l.outcome = 'escalation')::int as escalations,
           count(l.id) filter (where 'asked_price' = any(l.flags))::int as asked_price
    from calls c left join leads l on l.call_id = c.id
    where c.started_at > now() - interval '7 days'`) as Record<string, number>[];
  const [cost] = (await sql`
    select coalesce(sum(e.inr), 0)::float as inr from cost_events e join calls c on c.id = e.call_id
    where c.started_at > now() - interval '7 days'`) as { inr: number }[];
  const [pending] = (await sql`select count(*)::int as n from leads where review_status = 'pending'`) as { n: number }[];
  const upcoming = (await sql`
    select l.name, l.locality, l.consultation_at, d.name as designer from leads l left join designers d on d.id = l.designer_id
    where l.outcome = 'qualified' and l.consultation_at between now() and now() + interval '7 days'
    order by l.consultation_at limit 12`) as { name: string | null; locality: string | null; consultation_at: string; designer: string | null }[];
  return { k, cost: cost.inr, pending: pending.n, upcoming };
}

export function digestHtml(d: Awaited<ReturnType<typeof digestData>>, appUrl: string) {
  const tile = (label: string, value: string | number) =>
    `<td style="padding:14px 16px;border:1px solid #e7dfd3;border-radius:12px;background:#fffdf9;width:25%"><div style="font-size:11px;letter-spacing:.12em;color:#7a7064;text-transform:uppercase">${label}</div><div style="font-family:Georgia,serif;font-size:28px;color:#1f1b16;margin-top:6px">${value}</div></td>`;
  const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const rows = d.upcoming.map((u) => `<tr><td style="padding:8px 0;border-top:1px solid #efe8dd">${u.name ?? "Client"} · ${u.locality?.split(",")[0] ?? ""}</td><td style="padding:8px 0;border-top:1px solid #efe8dd;color:#7a7064;text-align:right">${when(u.consultation_at)} · ${u.designer ?? ""}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f2ec;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f1b16">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 18px"><div style="font-family:Georgia,serif;letter-spacing:.2em;color:#b5552e">AANGAN</div>
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:14px 0 4px">Your week, Nikhil.</h1>
<p style="margin:0;color:#7a7064;font-size:14px">The last 7 days of calls, in one glance.</p></td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="8"><tr>${tile("Calls", d.k.calls)}${tile("Booked", d.k.booked)}${tile("After hours", d.k.after_hours)}${tile("Cost", `₹${Math.round(d.cost).toLocaleString("en-IN")}`)}</tr></table></td></tr>
<tr><td style="padding:14px 4px;font-size:14px;line-height:1.7">
${d.k.declined} kindly declined · ${d.k.missed} missed and called back · ${d.k.escalations} existing-client issues · ${d.k.asked_price} asked about price (no figures given).<br>
<strong>${d.pending}</strong> waiting for the front desk right now.</td></tr>
${rows ? `<tr><td style="padding:8px 4px"><div style="font-size:11px;letter-spacing:.12em;color:#7a7064;text-transform:uppercase;margin-bottom:6px">Consultations this week</div><table role="presentation" width="100%" style="font-size:14px">${rows}</table></td></tr>` : ""}
<tr><td style="padding:22px 4px"><a href="${appUrl}" style="display:inline-block;background:#1f1b16;color:#fffdf9;text-decoration:none;padding:11px 20px;border-radius:999px;font-size:14px">Open Concierge</a></td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendDigest() {
  const s = await getSettings();
  const to = s.founderEmail || s.handoffInbox;
  if (!to || !process.env.RESEND_API_KEY) return { skipped: "no founder email set" };
  const d = await digestData();
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: `Aangan Concierge <${process.env.RESEND_FROM ?? "onboarding@resend.dev"}>`,
    to,
    subject: `Your week: ${d.k.calls} calls, ${d.k.booked} booked`,
    html: digestHtml(d, process.env.APP_URL ?? ""),
  });
  await logIntegration("resend", !error, error ? `digest: ${error.message}` : "weekly digest");
  return { sent: !error };
}

// The one daily cron (09:00 IST): recovery, privacy cleanup, and the digest on Mondays.
export async function daily() {
  const out: Record<string, unknown> = {};
  out.reconcile = await reconcile().catch((e) => String(e));
  out.retention = await retention().catch((e) => String(e));
  const istDay = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getDay();
  if (istDay === 1) out.digest = await sendDigest().catch((e) => String(e));
  await setMarker("last_daily", new Date().toISOString());
  return out;
}
