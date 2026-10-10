// Checks the two edge cases without calling Vaani or touching real Cal.com bookings.
// Run: npx tsx --conditions=react-server --env-file=../.env scripts/test-fixes.ts [--clean]
import { readFileSync } from "node:fs";
import { sql } from "../src/lib/db";
import { callerSpoke, processCall } from "../src/lib/pipeline";

const FAKE_PHONE = "+910000000001";

async function clean() {
  await sql`delete from calls where vaani_call_id like 'test-%'`;
}

async function main() {
  if (process.argv.includes("--clean")) { await clean(); console.log("Test rows removed."); return; }
  await clean();

  // 0. Regression: every September call has the caller speaking; an empty or agent-only call doesn't.
  const sept = JSON.parse(readFileSync(new URL("../data/september-phone-calls.json", import.meta.url), "utf8")) as { transcript: string }[];
  const spoke = sept.filter((c) => callerSpoke(c.transcript)).length;
  console.log(`callerSpoke: ${spoke}/${sept.length} September calls · empty=${callerSpoke("")} · agent-only=${callerSpoke("[00:00:01] AGENT: Namaste, Aangan Studio.")}`);

  // 1. Silent caller: the agent greets, nobody answers.
  const missed = await processCall({
    source: "vaani", vaaniCallId: "test-missed", sideEffects: true, fromNumber: FAKE_PHONE,
    transcript: "[00:00:01] AGENT: Namaste, Aangan Studio. This call is recorded so our designers can prepare for you. How can I help you today?\n[00:00:09] AGENT: Hello? I'll let you go for now.",
    startedAt: new Date(Date.now() - 20 * 60_000), durationSec: 14, answerSec: 2,
    lookupBooking: async () => null,
  });
  console.log("silent call →", missed);

  // 2. The agent booked a slot, but the caller is in Nashik, so the checks decline.
  const conflict = await processCall({
    source: "vaani", vaaniCallId: "test-slot-conflict", sideEffects: true, fromNumber: FAKE_PHONE,
    transcript: [
      "[00:00:01] AGENT: Namaste, Aangan Studio. This call is recorded so our designers can prepare for you. How can I help you today?",
      "[00:00:06] USER: Hi, I'm Rohan. I have a 3BHK in Nashik, about 1,200 square feet, and I want the whole home designed and executed.",
      "[00:00:15] AGENT: Lovely. When would you need the project complete?",
      "[00:00:19] USER: By March. My wife and I decide together and she's happy to go ahead.",
      "[00:00:26] AGENT: I've booked a consultation for Thursday at 11.",
    ].join("\n"),
    startedAt: new Date(Date.now() - 10 * 60_000), durationSec: 95, answerSec: 2,
    lookupBooking: async () => ({
      uid: "test-booking-uid", status: "accepted", start: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      hosts: [{ email: "isha.bhide@example.com", name: "Isha Bhide" }],
    }),
  });
  console.log("slot conflict →", conflict);

  const rows = (await sql`
    select c.vaani_call_id, l.id, l.outcome, l.review_status, l.flags, l.consultation_at is not null as has_slot, d.name as designer,
           (select string_agg(note, ' | ' order by at, id) from lead_events e where e.lead_id = l.id) as events
    from leads l join calls c on c.id = l.call_id left join designers d on d.id = l.designer_id
    where c.vaani_call_id like 'test-%' order by c.started_at`) as Record<string, unknown>[];
  for (const r of rows) console.log(JSON.stringify(r, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
