// Replays September's real phone enquiries through the Concierge pipeline, so the dashboard shows
// what Aangan would have seen. No emails are sent and nothing goes to HubSpot. Run: npm run db:replay
import { readFileSync } from "node:fs";
import { sql } from "../src/lib/db";
import { processCall } from "../src/lib/pipeline";

type Seed = { ref: string; startedAt: string; durationSec: number; transcript: string };

async function main() {
  const calls = JSON.parse(readFileSync(new URL("../data/september-phone-calls.json", import.meta.url), "utf8")) as Seed[];
  await sql`delete from calls where source = 'replay'`;
  for (const c of calls) {
    const r = await processCall({
      source: "replay",
      vaaniCallId: `replay-${c.ref}`,
      transcript: c.transcript,
      startedAt: new Date(c.startedAt),
      durationSec: c.durationSec,
      answerSec: 2 + Math.round(Math.random() * 4),
      sideEffects: false,
    });
    console.log(c.ref, "outcome" in r ? r.outcome : "duplicate");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
