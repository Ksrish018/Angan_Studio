import { after } from "next/server";
import { sql } from "@/lib/db";
import { maybeReconcile } from "@/lib/jobs";

// Polled every 15 seconds by the dashboard: calls in progress and the newest enquiry.
export async function GET() {
  // While anyone has the dashboard open, look for dropped calls every few minutes.
  after(maybeReconcile);
  const active = (await sql`
    select vaani_call_id as id, started_at from live_calls
    where ended_at is null and started_at > now() - interval '30 minutes'
    order by started_at`) as { id: string; started_at: string }[];
  const [latest] = (await sql`
    select l.id, l.name, l.outcome, l.locality, l.property_type, l.consultation_at, d.name as designer
    from leads l left join designers d on d.id = l.designer_id
    order by l.id desc limit 1`) as {
    id: number; name: string | null; outcome: string; locality: string | null; property_type: string | null;
    consultation_at: string | null; designer: string | null;
  }[];
  const [{ pending }] = (await sql`select count(*)::int as pending from leads where review_status = 'pending'`) as { pending: number }[];
  return Response.json({ active, latest: latest ?? null, pending });
}
