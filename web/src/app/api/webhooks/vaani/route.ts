import { after } from "next/server";
import { sql } from "@/lib/db";
import { logIntegration } from "@/lib/ops";
import { processCall } from "@/lib/pipeline";
import { getCallDetails, getCallTranscript, type VaaniPostprocessing } from "@/lib/integrations/vaani";

// Registered in Vaani (Settings → Webhooks) as https://<app>/api/webhooks/vaani?token=<VAANI_WEBHOOK_TOKEN>.
// Vaani retries non-2xx responses, so acknowledge fast and do the work after responding.
//
// Test mode: with header "x-concierge-test: <CRON_SECRET>", the payload's own data.from_number / data.started_at
// are used instead of looking the call up in Vaani, so the full pipeline can be exercised without Vaani.
type TestExtras = { from_number?: string; started_at?: string };

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!process.env.VAANI_WEBHOOK_TOKEN || token !== process.env.VAANI_WEBHOOK_TOKEN) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  const test = !!process.env.CRON_SECRET && request.headers.get("x-concierge-test") === process.env.CRON_SECRET;

  let body: VaaniPostprocessing;
  try {
    body = (await request.json()) as VaaniPostprocessing;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const callId = body.call_id ?? body.data?.call_id;
  await logIntegration("vaani", true, `webhook ${body.event}${test ? " (test)" : ""}`);

  if (callId && body.event === "call_started") {
    await sql`insert into live_calls (vaani_call_id) values (${callId}) on conflict do nothing`;
    return Response.json({ live: callId });
  }
  if (callId && body.event === "call_ended") {
    await sql`insert into live_calls (vaani_call_id, ended_at) values (${callId}, now())
              on conflict (vaani_call_id) do update set ended_at = now()`;
    return Response.json({ ended: callId });
  }
  if (body.event !== "call_postprocessing") return Response.json({ ignored: body.event });
  if (!callId) return Response.json({ ignored: "no call id" });

  const data = (body.data ?? {}) as Record<string, unknown>;
  const extras = data as TestExtras;
  // Record the payload's shape (field names only, never contents) to check what Vaani actually sends.
  if (!test) await logIntegration("vaani", true, `postprocessing fields: ${Object.keys(data).sort().join(", ").slice(0, 400)}`);

  after(async () => {
    try {
      // The transcript may arrive under different names, or as a list of turns. If it's missing, ask Vaani for it
      // before deciding the caller was silent: an empty transcript means a hang-up or silent call.
      let transcript = readTranscript(data);
      if (!transcript && !test) transcript = (await getCallTranscript(callId).catch(() => null))?.transcript ?? "";
      const details = test ? null : await getCallDetails(callId);
      if (!test) await logIntegration("vaani", !!details, details ? "call details found" : "call details not found in recent history");
      const durationSec = Math.round((details?.duration_ms ?? Number(data.call_duration ?? data.duration_ms ?? 0)) / 1000);
      const startedAt = details?.Start_time
        ? new Date(details.Start_time)
        : extras.started_at ? new Date(extras.started_at) : new Date(Date.now() - durationSec * 1000);
      await processCall({
        source: "vaani",
        vaaniCallId: callId,
        transcript,
        startedAt,
        endedAt: details?.End_time ? new Date(details.End_time) : undefined,
        durationSec,
        answerSec: 2,
        fromNumber: details?.from_number ?? extras.from_number ?? str(data.from_number) ?? null,
        recordingUrl: str(data.recording_url) ?? str(data.recording_api) ?? null,
        vaaniSummary: str(data.summary) ?? str(data.call_summary) ?? details?.call_summary ?? null,
        endReason: str(data.end_reason) ?? null,
        credits: details?.call_cost ?? null,
        raw: body,
        sideEffects: true,
      });
      await sql`update live_calls set ended_at = coalesce(ended_at, now()) where vaani_call_id = ${callId}`;
    } catch (e) {
      await logIntegration("vaani", false, `processing ${callId}: ${String(e)}`);
    }
  });

  return Response.json({ received: callId });
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

// Accepts "[00:00:05] USER: text" strings, or arrays of {role/speaker, text/content} turns.
function readTranscript(data: Record<string, unknown>): string {
  for (const key of ["transcript", "transcription", "call_transcription", "conversation"]) {
    const v = data[key];
    if (typeof v === "string" && v.trim() && !v.startsWith("Transcript is not available")) return v;
    if (Array.isArray(v) && v.length) {
      return v
        .map((t: Record<string, unknown>) => {
          const who = String(t.role ?? t.speaker ?? t.from ?? "").toLowerCase();
          const text = String(t.text ?? t.content ?? t.message ?? "");
          return `${/user|caller|customer|human/.test(who) ? "USER" : "AGENT"}: ${text}`;
        })
        .join(String.fromCharCode(10));
    }
  }
  return "";
}
