// Pushes only the agent's system prompt to Vaani (keeps tools and everything else as configured in Vaani).
// Run: npx tsx --conditions=react-server --env-file=../.env scripts/vaani-prompt.ts
import { agentConfig } from "../src/knowledge/agent-config";

async function main() {
  const id = process.env.VAANI_AGENT_ID!;
  const res = await fetch(`https://api.vaanivoice.ai/api/agent/${id}/persona`, {
    method: "PATCH",
    headers: { "X-API-Key": process.env.VAANI_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ identity: { system_prompt: agentConfig().persona.identity.system_prompt } }),
  });
  const body = await res.json();
  const text = JSON.stringify(body);
  console.log("status", res.status, "| prompt names the tools:", !!body?.persona?.identity?.system_prompt?.includes("@book_appointment"));
  console.log("tools still configured:", ["book_appointment", "Check_availability_booking", "reschedule_appointment"].map((t) => `${t}=${text.includes(`"${t}"`) || text.includes(t)}`).join(" "));
}

main().catch((e) => { console.error(e); process.exit(1); });
