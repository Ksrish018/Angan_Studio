// Sends ONE test designer brief (with the calendar invite) to the given inbox. Run:
//   npx tsx --conditions=react-server --env-file=../.env scripts/send-test-brief.ts <inbox>
import { sql } from "../src/lib/db";
import { saveSettings } from "../src/lib/settings";
import { sendLeadHandoff } from "../src/lib/pipeline";

async function main() {
  const inbox = process.argv[2];
  if (!inbox) throw new Error("Pass the inbox");
  const [lead] = (await sql`select id, name from leads where outcome = 'qualified' and designer_id is not null and consultation_outcome is null order by id limit 1`) as { id: number; name: string }[];
  // Give it a realistic upcoming slot (Tuesday 11:00 IST) so the invite lands in the future.
  const slot = new Date(); slot.setUTCDate(slot.getUTCDate() + ((9 - slot.getUTCDay()) % 7 || 7)); slot.setUTCHours(5, 30, 0, 0);
  await sql`update leads set consultation_at = ${slot.toISOString()} where id = ${lead.id}`;
  await saveSettings({ handoffInbox: inbox });
  await sendLeadHandoff(lead.id);
  await saveSettings({ handoffInbox: "" });
  const [ev] = (await sql`select note from lead_events where lead_id = ${lead.id} and kind in ('handoff_sent','handoff_failed') order by id desc limit 1`) as { note: string }[];
  console.log(`Lead ${lead.id} (${lead.name}) →`, ev?.note);
}
main().catch((e) => { console.error(e); process.exit(1); });
