// Creates (or updates) the "Aangan Concierge" agent in Vaani from our knowledge pack. Makes no calls.
// Run: npx tsx --conditions=react-server --env-file=../.env scripts/vaani-setup.ts
import { agentConfig } from "../src/knowledge/agent-config";

const BASE = "https://api.vaanivoice.ai/api";
const headers = { "X-API-Key": process.env.VAANI_API_KEY!, "Content-Type": "application/json" };
const NAME = "Aangan Concierge";

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json: unknown = text;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const config = agentConfig();

  // Reuse an existing agent with the same name instead of creating duplicates.
  const list = await call("GET", `/agents?search=${encodeURIComponent(NAME)}&page_size=50`);
  const agents = (Array.isArray(list.json) ? list.json : (list.json as { data?: unknown[] })?.data ?? []) as { id: string; display_name?: string; agent_name?: string }[];
  let id = process.env.VAANI_AGENT_ID || agents.find((a) => a.display_name === NAME || a.agent_name === NAME)?.id;

  if (!id) {
    const created = await call("POST", "/create-agent", { agent_display_name: NAME, config });
    console.log("create-agent:", created.status, JSON.stringify(created.json).slice(0, 300));
    id = (created.json as { agent_id?: string })?.agent_id;
    if (!id) process.exit(1);
  } else {
    console.log("Updating existing agent", id);
  }

  // PATCH each section so everything is set even if create-agent ignored part of the config.
  for (const section of ["persona", "training", "analysis"] as const) {
    const r = await call("PATCH", `/agent/${id}/${section}`, config[section]);
    const warnings = (r.json as { warnings?: unknown })?.warnings;
    console.log(`${section}:`, r.status, r.ok ? "ok" : JSON.stringify(r.json).slice(0, 300), warnings ? `warnings: ${JSON.stringify(warnings).slice(0, 300)}` : "");
  }
  console.log(`\nVAANI_AGENT_ID=${id}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
