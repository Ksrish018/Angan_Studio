import { daily } from "@/lib/jobs";

// Vercel Cron calls this once a day with "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  return Response.json(await daily());
}
