// Vaani public API: https://docs.vaanivoice.ai (base https://api.vaanivoice.ai, header X-API-Key).
const BASE = "https://api.vaanivoice.ai/api";

export type VaaniPostprocessing = {
  event: string;
  call_id: string;
  timestamp?: string;
  data?: {
    call_id?: string;
    call_duration?: number; // milliseconds in call_postprocessing
    end_reason?: string;
    summary?: string;
    entities?: Record<string, unknown>;
    dispositions?: Record<string, unknown>;
    recording_url?: string;
    transcript?: string; // "[HH:MM:SS] AGENT|USER: text" lines
  };
};

export type VaaniCallHistory = {
  call_id: string;
  direction?: string;
  from_number?: string;
  to_number?: string;
  Start_time?: string;
  End_time?: string;
  duration_ms?: number;
  call_cost?: number; // credits
  call_summary?: string;
  call_transcription?: string;
  post_processing_status?: string;
  recording_api?: string;
};

function headers() {
  return { "X-API-Key": process.env.VAANI_API_KEY ?? "" };
}

// Recent calls, newest first. Call history has no call_id filter, so we read a page and match.
export async function recentCalls(pageSize = 100): Promise<VaaniCallHistory[]> {
  if (!process.env.VAANI_API_KEY) return [];
  const res = await fetch(`${BASE}/call-history?page=1&page_size=${pageSize}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Vaani call-history ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? body : body.data ?? [];
}

// The webhook has no caller number, times or cost, so look the call up in recent call history.
export async function getCallDetails(callId: string): Promise<VaaniCallHistory | null> {
  try {
    return (await recentCalls()).find((r) => r.call_id === callId) ?? null;
  } catch {
    return null;
  }
}

// Transcript and summary for one call (used to recover calls whose webhook never arrived).
export async function getCallTranscript(callId: string): Promise<{ transcript: string; summary: string | null } | null> {
  if (!process.env.VAANI_API_KEY) return null;
  const res = await fetch(`${BASE}/call_details/${encodeURIComponent(callId)}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return null;
  const body = await res.json();
  const NOT_READY = "Transcript is not available";
  const t = typeof body.transcription === "string" ? body.transcription : "";
  if (t.startsWith(NOT_READY)) return null;
  return { transcript: t, summary: typeof body.summary === "string" && !body.summary.startsWith(NOT_READY) ? body.summary : null };
}
