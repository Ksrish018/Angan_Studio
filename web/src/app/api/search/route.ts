import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [] });
  const like = `%${q}%`;
  const leads = (await sql`
    select l.id, l.name, l.locality, l.property_type, l.outcome
    from leads l
    where l.name ilike ${like} or l.locality ilike ${like} or l.scope ilike ${like} or l.property_type ilike ${like}
    order by l.id desc limit 6`) as { id: number; name: string | null; locality: string | null; property_type: string | null; outcome: string }[];
  const designers = (await sql`select id, name from designers where name ilike ${like} limit 3`) as { id: number; name: string }[];
  return Response.json({
    results: [
      ...leads.map((l) => ({ href: `/leads/${l.id}`, title: l.name ?? "Unknown caller", sub: [l.property_type, l.locality].filter(Boolean).join(" · "), kind: "Enquiry" })),
      ...designers.map((d) => ({ href: `/designers`, title: d.name, sub: "Designer", kind: "Designer" })),
    ],
  });
}
