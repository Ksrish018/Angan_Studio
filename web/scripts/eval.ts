// Grades Concierge against September's 39 real enquiries (phone, WhatsApp, web form) with
// answers labelled from Nikhil's qualified.md. Uses Gemini only: no Vaani, no database. Run: npm run eval
import { readFileSync, writeFileSync } from "node:fs";
import { extract } from "../src/lib/extract";
import { decide, containsPrice, scrubPrice } from "../src/lib/rules";

type Case = {
  ref: string; channel: string; date: string; text: string;
  expected: { outcome: string; decline_reason: string | null; flags: string[] };
};

const CHANNEL: Record<string, string> = { phone: "phone call", whatsapp: "WhatsApp thread", web_form: "website form" };

async function grade(c: Case) {
  const { data } = await extract(c.text, new Date(c.date), CHANNEL[c.channel]);
  const d = decide(data);
  const outcomeOk = d.outcome === c.expected.outcome;
  const reasonOk = !c.expected.decline_reason || d.declineReason === c.expected.decline_reason;
  const missingFlags = c.expected.flags.filter((f) => !d.flags.includes(f));
  const leaked = containsPrice(scrubPrice(data.summary)) || containsPrice(scrubPrice(data.designer_notes));
  return {
    ref: c.ref, channel: c.channel, expected: c.expected.outcome, got: d.outcome,
    expected_reason: c.expected.decline_reason, got_reason: d.declineReason,
    pass: outcomeOk && reasonOk && missingFlags.length === 0 && !leaked,
    missingFlags, leaked,
    why: Object.entries(d.criteria).filter(([, v]) => v.verdict !== "pass").map(([k, v]) => `${k}:${v.verdict} (${v.reason})`).join("; "),
  };
}

async function main() {
  const cases = JSON.parse(readFileSync(new URL("../data/enquiries-eval.json", import.meta.url), "utf8")) as Case[];
  const only = process.argv[2]?.split(",");
  const todo = only ? cases.filter((c) => only.includes(c.ref)) : cases;
  const results: Awaited<ReturnType<typeof grade>>[] = [];
  for (let i = 0; i < todo.length; i += 6) {
    results.push(...(await Promise.all(todo.slice(i, i + 6).map(grade))));
  }
  for (const r of results.filter((r) => !r.pass)) {
    console.log(`✗ ${r.ref} expected ${r.expected}${r.expected_reason ? ` (${r.expected_reason})` : ""}, got ${r.got}${r.got_reason ? ` (${r.got_reason})` : ""}` +
      `${r.missingFlags.length ? ` · missing flags ${r.missingFlags}` : ""}${r.leaked ? " · PRICE LEAK" : ""}\n    ${r.why}`);
  }
  const pass = results.filter((r) => r.pass).length;
  const byChannel = Object.groupBy(results, (r) => r.channel);
  console.log(`\nScore: ${pass}/${results.length} (${Math.round((pass / results.length) * 100)}%)`);
  for (const [ch, rs] of Object.entries(byChannel)) console.log(`  ${ch}: ${rs!.filter((r) => r.pass).length}/${rs!.length}`);
  console.log(`  price leaks in AI-written text: ${results.filter((r) => r.leaked).length}`);
  if (!only) writeFileSync(new URL("../data/eval-report.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), pass, total: results.length, results }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
