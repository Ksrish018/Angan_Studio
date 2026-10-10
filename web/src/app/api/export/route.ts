import { sql } from "@/lib/db";

// Every enquiry as a CSV that opens straight in Excel. Internal pricing is not included.
export async function GET() {
  const rows = (await sql`
    select l.id, c.started_at, c.after_hours, l.name, l.phone, l.locality, l.property_type, l.carpet_sqft, l.scope,
           l.timeline, l.decision_maker, l.source, l.outcome, l.decline_reason, array_to_string(l.flags, ' ') as flags,
           d.name as designer, l.consultation_at, l.consultation_outcome, l.review_status, c.duration_sec
    from leads l join calls c on c.id = l.call_id left join designers d on d.id = l.designer_id
    order by c.started_at desc`) as Record<string, unknown>[];
  const cols = ["id", "started_at", "after_hours", "name", "phone", "locality", "property_type", "carpet_sqft", "scope", "timeline",
    "decision_maker", "source", "outcome", "decline_reason", "flags", "designer", "consultation_at", "consultation_outcome", "review_status", "duration_sec"];
  const cell = (v: unknown) => {
    if (v == null) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="aangan-enquiries-${day}.csv"` },
  });
}
