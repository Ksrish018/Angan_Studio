import { sql } from "./db";
import { getMarker } from "./settings";
import { calcomMe, listEventTypes } from "./integrations/calcom";

export type Health = { service: string; label: string; state: "ok" | "warn" | "error"; detail: string; lastOk: string | null; lastError: string | null };

const timeout = <T,>(p: Promise<T>, ms = 6000) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);

async function lastLog(service: string) {
  const [ok] = (await sql`select at from integration_log where service = ${service} and ok order by at desc limit 1`) as { at: string }[];
  const [bad] = (await sql`select at, detail from integration_log where service = ${service} and not ok order by at desc limit 1`) as { at: string; detail: string }[];
  // Only show an error that happened after the last success: an old, fixed problem isn't news.
  const current = bad && (!ok || new Date(bad.at) > new Date(ok.at));
  return { lastOk: ok?.at ?? null, lastError: current ? bad.detail : null };
}

async function check(service: string, label: string, fn: () => Promise<{ state: Health["state"]; detail: string }>): Promise<Health> {
  const log = await lastLog(service);
  try {
    const r = await timeout(fn());
    return { service, label, ...r, lastOk: log.lastOk, lastError: log.lastError };
  } catch (e) {
    return { service, label, state: "error", detail: String(e instanceof Error ? e.message : e), lastOk: log.lastOk, lastError: log.lastError };
  }
}

// Live checks for the Connections panel. Vaani is checked by key and last webhook only, never by calling it.
export async function healthChecks(): Promise<Health[]> {
  return Promise.all([
    check("database", "Database (Neon)", async () => {
      const [r] = (await sql`select count(*)::int as n from calls`) as { n: number }[];
      return { state: "ok", detail: `Connected · ${r.n} calls stored` };
    }),
    check("vaani", "Voice agent (Vaani)", async () => {
      if (!process.env.VAANI_API_KEY) return { state: "error", detail: "API key missing" };
      if (!process.env.VAANI_WEBHOOK_TOKEN) return { state: "error", detail: "Webhook token missing" };
      const [w] = (await sql`select at from integration_log where service = 'vaani' and detail like 'webhook%' and detail not like '%(test)%' order by at desc limit 1`) as { at: string }[];
      return w
        ? { state: "ok", detail: `Key set · last call event received ${new Date(w.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` }
        : { state: "warn", detail: "Key set · no real call received yet. Register the webhook in Vaani and assign a number." };
    }),
    check("gemini", "Call analysis (Gemini)", async () => {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" }, cache: "no-store",
      });
      return res.ok ? { state: "ok", detail: `Key works · model ${process.env.GEMINI_MODEL ?? "gemini-flash-latest"}` } : { state: "error", detail: `Google answered ${res.status}` };
    }),
    check("calcom", "Calendar (Cal.com)", async () => {
      const me = await calcomMe();
      const types = await listEventTypes().catch(() => []);
      const consult = types.find((t) => /consult/i.test(t.slug) || /consult/i.test(t.title));
      return consult
        ? { state: "ok", detail: `Connected as ${me.username ?? me.email ?? "your account"} · "${consult.title}" (${consult.lengthInMinutes} min) ready for bookings` }
        : { state: "warn", detail: `Connected as ${me.username ?? me.email ?? "your account"} · no consultation event type yet` };
    }),
    check("hubspot", "CRM (HubSpot)", async () => {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` }, cache: "no-store",
      });
      return res.ok ? { state: "ok", detail: "Service key works · contacts and deals" } : { state: "error", detail: `HubSpot answered ${res.status}` };
    }),
    check("resend", "Email (Resend)", async () => {
      if (!process.env.RESEND_API_KEY) return { state: "error", detail: "API key missing" };
      const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
      return from.endsWith("resend.dev")
        ? { state: "warn", detail: "Test sender: emails reach only the Resend account owner. Verify Aangan's domain to email designers directly." }
        : { state: "ok", detail: `Sending as ${from}` };
    }),
    check("cron", "Background jobs", async () => {
      const [daily, rec] = await Promise.all([getMarker("last_daily"), getMarker("last_reconcile")]);
      const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "not yet");
      return { state: daily ? "ok" : "warn", detail: `Daily run: ${fmt(daily)} · call recovery: ${fmt(rec)}` };
    }),
  ]);
}
