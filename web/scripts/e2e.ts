// End-to-end test of the live path WITHOUT Vaani: posts Vaani-shaped webhook events to the app in test mode,
// then checks what landed in the database. Real Gemini, Cal.com lookup, HubSpot and Resend are used.
//   npx tsx --conditions=react-server --env-file=../.env scripts/e2e.ts <baseUrl> [inbox]   run
//   npx tsx --conditions=react-server --env-file=../.env scripts/e2e.ts --clean               remove test data
import { sql } from "../src/lib/db";
import { saveSettings } from "../src/lib/settings";

const TOKEN = process.env.VAANI_WEBHOOK_TOKEN!;
const SECRET = process.env.CRON_SECRET!;
const PHONE = "+910000000042";
const RUN = `e2e-${Date.now().toString(36)}`;

async function post(base: string, body: unknown, opts: { token?: string; test?: boolean } = {}) {
  const res = await fetch(`${base}/api/webhooks/vaani?token=${opts.token ?? TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.test === false ? {} : { "x-concierge-test": SECRET }) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text() };
}

const turns = (lines: [string, string][]) => lines.map(([who, t], i) => `[00:00:${String(i * 7).padStart(2, "0")}] ${who}: ${t}`).join("\n");

const CALLS: Record<string, { transcript: string; minutes: number }> = {
  qualified: {
    minutes: 4,
    transcript: turns([
      ["AGENT", "Namaste, Aangan Studio. This call is recorded so our designers can prepare for you. How can I help you today?"],
      ["USER", "Hi, I'm Meghna Joshi. We just bought a 3BHK in Baner, about 1,250 square feet carpet, and want the whole flat designed and executed."],
      ["AGENT", "Congratulations! When would you need the project complete?"],
      ["USER", "By the end of March. My husband and I decide together, and he's asked me to go ahead."],
      ["AGENT", "Lovely. How did you hear about Aangan?"],
      ["USER", "Instagram. Roughly how much would it cost per square foot?"],
      ["AGENT", "Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like."],
      ["USER", "Okay, please book a site visit."],
    ]),
  },
  silent: { minutes: 0.3, transcript: turns([["AGENT", "Namaste, Aangan Studio. This call is recorded. How can I help you today?"], ["AGENT", "Hello? I'll let you go for now."]]) },
  declined: {
    minutes: 2,
    transcript: turns([
      ["AGENT", "Namaste, Aangan Studio. How can I help you today?"],
      ["USER", "Hello, I have a 2BHK in Lonavala, a holiday home, and want full interiors done."],
      ["AGENT", "Thank you for thinking of us. We only work in Pune and PCMC at the moment, so we can't take that on."],
    ]),
  },
  escalation: {
    minutes: 3,
    transcript: turns([
      ["AGENT", "Namaste, Aangan Studio. How can I help you today?"],
      ["USER", "I'm Kunal Shah, my flat in Aundh is being done by your team and the site has been idle for a week. Nobody answers my messages."],
      ["AGENT", "I'm very sorry. I'm connecting you to our senior lead now."],
    ]),
  },
};

async function waitForLead(callId: string, ms = 90_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const [r] = (await sql`
      select l.id, l.outcome, l.flags, l.review_status, l.name, l.locality, d.name as designer, l.hubspot_contact_id, l.hubspot_deal_id,
             l.handoff_emailed_at is not null as emailed, c.after_hours,
             (select string_agg(e.note, ' | ' order by e.at, e.id) from lead_events e where e.lead_id = l.id) as events
      from calls c join leads l on l.call_id = c.id left join designers d on d.id = l.designer_id
      where c.vaani_call_id = ${callId}`) as Record<string, unknown>[];
    if (r && (r.outcome !== "qualified" || r.emailed || String(r.events ?? "").includes("failed"))) return r;
    await new Promise((res) => setTimeout(res, 2000));
  }
  return null;
}

async function send(base: string, key: string) {
  const id = `${RUN}-${key}`;
  const c = CALLS[key];
  console.log(`\n▶ ${key}`);
  console.log("  call_started:", (await post(base, { event: "call_started", call_id: id })).status);
  console.log("  call_ended:", (await post(base, { event: "call_ended", call_id: id, data: { call_duration: c.minutes * 60 } })).status);
  const r = await post(base, {
    event: "call_postprocessing", call_id: id,
    data: { call_id: id, call_duration: c.minutes * 60_000, transcript: c.transcript, summary: null, from_number: PHONE, started_at: new Date(Date.now() - c.minutes * 60_000).toISOString() },
  });
  console.log("  call_postprocessing:", r.status, r.body);
  const lead = await waitForLead(id);
  console.log("  result:", JSON.stringify(lead, null, 1));
  return { id, lead };
}

async function clean() {
  const leads = (await sql`select l.hubspot_contact_id, l.hubspot_deal_id from leads l join calls c on c.id = l.call_id where c.vaani_call_id like 'e2e-%'`) as { hubspot_contact_id: string | null; hubspot_deal_id: string | null }[];
  for (const l of leads) {
    for (const [type, id] of [["deals", l.hubspot_deal_id], ["contacts", l.hubspot_contact_id]] as const) {
      if (!id) continue;
      const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${type}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } });
      console.log(`HubSpot ${type} ${id} deleted: ${res.status}`);
    }
  }
  await sql`delete from calls where vaani_call_id like 'e2e-%'`;
  await sql`delete from live_calls where vaani_call_id like 'e2e-%'`;
  await saveSettings({ handoffInbox: "" });
  console.log("Test calls, live-call rows and the test inbox setting removed.");
}

async function main() {
  if (process.argv.includes("--clean")) return clean();
  const base = process.argv[2] ?? "http://localhost:3000";
  const inbox = process.argv[3];

  console.log("Auth checks:");
  console.log("  wrong token →", (await post(base, { event: "call_started", call_id: "x" }, { token: "wrong" })).status);
  console.log("  unknown event →", (await post(base, { event: "user_picked_up_at", call_id: "x" })).body);

  // 1. A booked caller: Gemini → rules → Cal.com lookup → HubSpot → handoff email (to the test inbox only).
  if (inbox) await saveSettings({ handoffInbox: inbox, founderEmail: "" });
  const q = await send(base, "qualified");
  console.log("  duplicate delivery →", (await post(base, { event: "call_postprocessing", call_id: q.id, data: { transcript: CALLS.qualified.transcript } })).body);
  const [{ n }] = (await sql`select count(*)::int as n from calls where vaani_call_id = ${q.id}`) as { n: number }[];
  console.log(`  rows for this call after duplicate: ${n}`);

  // 2-4. No more email: clear the inbox so alerts have nowhere to go.
  await saveSettings({ handoffInbox: "" });
  await send(base, "silent");
  await send(base, "declined");
  await send(base, "escalation");

  const log = (await sql`select service, ok, detail from integration_log where at > now() - interval '10 minutes' order by id`) as Record<string, unknown>[];
  console.log("\nIntegration log (last 10 min):");
  for (const l of log) console.log(`  ${l.ok ? "✓" : "✗"} ${l.service}: ${String(l.detail).slice(0, 140)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
