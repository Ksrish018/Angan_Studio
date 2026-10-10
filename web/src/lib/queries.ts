import { connection } from "next/server";
import { sql } from "./db";
import { containsPrice, type Criteria } from "./rules";

export type Range = "7d" | "30d" | "all";
const since = (r: Range) =>
  r === "all" ? "1970-01-01" : new Date(Date.now() - (r === "7d" ? 7 : 30) * 86_400_000).toISOString();

export async function overview(range: Range) {
  await connection();
  const from = since(range);
  const [k] = (await sql`
    select count(*)::int as calls,
           count(*) filter (where c.after_hours)::int as after_hours,
           coalesce(percentile_cont(0.5) within group (order by c.answer_sec), 0)::float as median_answer,
           count(l.id) filter (where l.outcome = 'qualified')::int as qualified,
           count(l.id) filter (where l.consultation_at is not null)::int as booked,
           count(l.id) filter (where l.outcome = 'declined')::int as declined,
           count(l.id) filter (where 'asked_price' = any(l.flags))::int as asked_price,
           coalesce(sum(c.duration_sec), 0)::int as seconds,
           bool_or(c.source = 'replay') as has_replay
    from calls c left join leads l on l.call_id = c.id
    where c.started_at >= ${from}`) as {
    calls: number; after_hours: number; median_answer: number; qualified: number; booked: number;
    declined: number; asked_price: number; seconds: number; has_replay: boolean | null;
  }[];

  const costs = (await sql`
    select e.vendor, sum(e.inr)::float as inr, bool_or(e.estimated) as estimated
    from cost_events e join calls c on c.id = e.call_id
    where c.started_at >= ${from} group by e.vendor`) as { vendor: string; inr: number; estimated: boolean }[];

  const hours = (await sql`
    select extract(hour from c.started_at at time zone 'Asia/Kolkata')::int as hour, count(*)::int as n
    from calls c where c.started_at >= ${from} group by 1`) as { hour: number; n: number }[];

  const reasons = (await sql`
    select coalesce(l.decline_reason, 'Other') as reason, count(*)::int as n
    from leads l join calls c on c.id = l.call_id
    where l.outcome = 'declined' and c.started_at >= ${from} group by 1 order by 2 desc`) as { reason: string; n: number }[];

  const [pending] = (await sql`select count(*)::int as n from leads where review_status = 'pending'`) as { n: number }[];

  // Price audit: scan what the agent itself said on live calls (replayed calls were the front desk, not AI).
  const live = (await sql`select transcript from calls where source = 'vaani' and started_at >= ${from}`) as { transcript: string | null }[];
  const priceSlips = live.length
    ? live.filter((c) => (c.transcript ?? "").split("\n").some((l) => /\bAGENT\b/.test(l) && containsPrice(l))).length
    : null;

  return { k, costs, hours, reasons, pending: pending.n, priceSlips, liveCalls: live.length };
}

export type LeadRow = {
  id: number; name: string | null; locality: string | null; property_type: string | null; carpet_sqft: number | null;
  scope: string | null; outcome: string; decline_reason: string | null; flags: string[]; review_status: string;
  consultation_at: string | null; designer: string | null; started_at: string; after_hours: boolean; source: string;
  project_kind: string | null;
  consultation_outcome: string | null;
};

export async function leads(filter: { outcome?: string; q?: string; limit?: number } = {}) {
  await connection();
  const outcome = filter.outcome ?? null;
  const q = filter.q ? `%${filter.q}%` : null;
  return (await sql`
    select l.id, l.name, l.locality, l.property_type, l.carpet_sqft, l.scope, l.outcome, l.decline_reason, l.flags,
           l.review_status, l.consultation_at, d.name as designer, c.started_at, c.after_hours, c.source, l.project_kind, l.consultation_outcome
    from leads l join calls c on c.id = l.call_id left join designers d on d.id = l.designer_id
    where (${outcome}::text is null or l.outcome = ${outcome})
      and (${q}::text is null or l.name ilike ${q} or l.locality ilike ${q} or l.scope ilike ${q})
    order by c.started_at desc
    limit ${filter.limit ?? 200}`) as LeadRow[];
}

export type LeadDetail = LeadRow & {
  phone: string | null; timeline: string | null; decision_maker: string | null; source_text: string | null;
  budget_volunteered: string | null; criteria: Criteria; summary: string | null; designer_notes: string | null;
  consultation_mode: string | null; transcript: string | null; duration_sec: number | null; answer_sec: number | null;
  recording_url: string | null; designer_email: string | null; consultation_outcome: string | null;
  handoff_emailed_at: string | null; hubspot_deal_id: string | null; project_kind: string | null;
  designer_id: number | null;
};

export async function lead(id: number) {
  await connection();
  const [row] = (await sql`
    select l.*, l.source as source_text, d.name as designer, d.email as designer_email,
           c.started_at, c.after_hours, c.source, c.transcript, c.duration_sec, c.answer_sec, c.recording_url
    from leads l join calls c on c.id = l.call_id left join designers d on d.id = l.designer_id
    where l.id = ${id}`) as LeadDetail[];
  if (!row) return null;
  const events = (await sql`select actor, kind, note, at from lead_events where lead_id = ${id} order by at, id`) as {
    actor: string; kind: string; note: string | null; at: string;
  }[];
  return { ...row, events };
}

export async function reviewQueue() {
  await connection();
  return (await sql`
    select l.id, l.name, l.locality, l.property_type, l.scope, l.outcome, l.decline_reason, l.flags, l.summary,
           l.criteria, c.started_at, c.after_hours, l.created_at, l.consultation_at, d.name as designer, l.phone
    from leads l join calls c on c.id = l.call_id left join designers d on d.id = l.designer_id
    where l.review_status = 'pending'
    order by (l.outcome = 'escalation') desc, (l.outcome = 'missed') desc, c.started_at asc`) as (LeadRow & { summary: string | null; criteria: Criteria; created_at: string; phone: string | null })[];
}

export async function designers() {
  await connection();
  return (await sql`
    select d.id, d.name, d.email, d.phone, d.specialty, d.is_principal, d.is_demo, d.active, d.paused,
           count(l.id)::int as consultations,
           count(l.id) filter (where l.consultation_at > now())::int as upcoming,
           count(l.id) filter (where l.consultation_outcome = 'proposal_sent')::int as proposals,
           min(l.consultation_at) filter (where l.consultation_at > now()) as next_at
    from designers d left join leads l on l.designer_id = d.id
    where d.active
    group by d.id order by d.paused, d.is_principal desc, d.name`) as {
    id: number; name: string; email: string; phone: string | null; specialty: string | null; is_principal: boolean;
    is_demo: boolean; active: boolean; paused: boolean; consultations: number; upcoming: number; proposals: number; next_at: string | null;
  }[];
}

// The most recent day with calls, for the timeline strip on the overview.
export async function latestDay() {
  await connection();
  const rows = (await sql`
    with d as (select max((started_at at time zone 'Asia/Kolkata')::date) as day from calls)
    select l.id, l.name, l.outcome, c.started_at, c.after_hours,
           extract(hour from c.started_at at time zone 'Asia/Kolkata') + extract(minute from c.started_at at time zone 'Asia/Kolkata') / 60.0 as hour,
           (select day from d) as day
    from calls c join leads l on l.call_id = c.id
    where (c.started_at at time zone 'Asia/Kolkata')::date = (select day from d)
    order by c.started_at`) as { id: number; name: string | null; outcome: string; started_at: string; after_hours: boolean; hour: number; day: string }[];
  return rows;
}

// Booked work, for the internal indicative pipeline value (never shown to callers).
export async function bookedScopes(range: Range) {
  await connection();
  return (await sql`
    select l.project_kind, l.carpet_sqft from leads l join calls c on c.id = l.call_id
    where l.outcome = 'qualified' and c.started_at >= ${since(range)}`) as { project_kind: string | null; carpet_sqft: number | null }[];
}

// A designer's own consultations, newest first.
export async function myConsultations(designerId: number) {
  await connection();
  return (await sql`
    select l.id, l.name, l.phone, l.locality, l.property_type, l.project_kind, l.carpet_sqft, l.scope, l.consultation_at,
           l.consultation_mode, l.consultation_outcome, l.flags, l.outcome,
           case when (l.consultation_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date then 'today'
                when l.consultation_at > now() then 'upcoming' else 'past' end as bucket
    from leads l
    where l.designer_id = ${designerId} and l.consultation_at is not null
    order by l.consultation_at desc`) as {
    id: number; name: string | null; phone: string | null; locality: string | null; property_type: string | null; project_kind: string | null;
    carpet_sqft: number | null; scope: string | null; consultation_at: string; consultation_mode: string | null;
    consultation_outcome: string | null; flags: string[]; outcome: string; bucket: "today" | "upcoming" | "past";
  }[];
}

// Everything the overview's pipeline and charts need, for the chosen range.
export async function insights(range: Range) {
  await connection();
  const from = since(range);
  const [p] = (await sql`
    select count(*)::int as calls,
           count(l.id) filter (where l.outcome <> 'missed')::int as spoke,
           count(l.id) filter (where l.outcome in ('qualified', 'needs_info'))::int as fit,
           count(l.id) filter (where l.outcome = 'qualified' and l.consultation_at is not null)::int as booked,
           count(l.id) filter (where l.consultation_outcome in ('proposal_sent', 'not_a_fit'))::int as held,
           count(l.id) filter (where l.consultation_outcome = 'proposal_sent')::int as proposals
    from calls c left join leads l on l.call_id = c.id
    where c.started_at >= ${from}`) as Record<"calls" | "spoke" | "fit" | "booked" | "held" | "proposals", number>[];

  const mix = (await sql`
    select l.outcome, count(*)::int as n from leads l join calls c on c.id = l.call_id
    where c.started_at >= ${from} group by 1`) as { outcome: string; n: number }[];

  // Calls per day (IST) for the last 30 days of the range, split into booked and the rest.
  const daily = (await sql`
    with bounds as (
      select greatest((now() at time zone 'Asia/Kolkata')::date,
                      coalesce(max((started_at at time zone 'Asia/Kolkata')::date), (now() at time zone 'Asia/Kolkata')::date)) as last
      from calls
    ), days as (
      select generate_series((select last from bounds) - 29, (select last from bounds), interval '1 day')::date as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day,
           count(c.id)::int as calls,
           count(l.id) filter (where l.outcome = 'qualified')::int as booked
    from days d
    left join calls c on (c.started_at at time zone 'Asia/Kolkata')::date = d.day and c.started_at >= ${from}
    left join leads l on l.call_id = c.id
    group by d.day order by d.day`) as { day: string; calls: number; booked: number }[];

  const sources = (await sql`
    select l.source from leads l join calls c on c.id = l.call_id
    where c.started_at >= ${from} and l.source is not null`) as { source: string }[];

  const areas = (await sql`
    select initcap(trim(split_part(l.locality, ',', 1))) as area, count(*)::int as n
    from leads l join calls c on c.id = l.call_id
    where c.started_at >= ${from} and l.locality is not null and l.in_service_area is not false
    group by 1 order by 2 desc limit 6`) as { area: string; n: number }[];

  const workload = (await sql`
    select d.name, count(l.id) filter (where l.consultation_at > now())::int as upcoming,
           count(l.id) filter (where l.consultation_at <= now())::int as done
    from designers d left join leads l on l.designer_id = d.id and l.outcome = 'qualified'
    where d.active group by d.id order by upcoming desc, d.name limit 8`) as { name: string; upcoming: number; done: number }[];

  return { pipeline: p, mix, daily, sources: groupSources(sources.map((s) => s.source)), areas, workload };
}

// Free-text "how did you hear about us" → a handful of channels Nikhil can act on.
function groupSources(list: string[]) {
  const buckets: [string, RegExp][] = [
    ["Referral", /referr|friend|client|recommend|neighbo|colleague|family|asked me/i],
    ["Instagram", /insta/i],
    ["Google", /google|search|website|online/i],
    ["LinkedIn", /linkedin/i],
    ["Builder / developer", /builder|developer|possession/i],
    ["Press", /article|mirror|news|magazine|press/i],
  ];
  const counts = new Map<string, number>();
  for (const s of list) {
    const name = buckets.find(([, re]) => re.test(s))?.[0] ?? "Other";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
}
