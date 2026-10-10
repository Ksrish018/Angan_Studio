// Writes the Vaani agent configuration (for review, then pasting or a later API push) to ../knowledge/.
// Fails if any pricing figure has slipped into the agent's brief. Run: npm run agent:build
import { mkdirSync, writeFileSync } from "node:fs";
import { agentConfig } from "../src/knowledge/agent-config";
import { DATA_POINTS, DISPOSITIONS, GREETING, SYSTEM_PROMPT } from "../src/knowledge/agent";
import { containsPrice } from "../src/lib/rules";

const PRICING_FIGURES = ["1,800", "2,400", "3,500", "1,200", "2,800", "4,000", "3.5 lakh", "8 lakh"];

const leaks = [
  ...SYSTEM_PROMPT.split("\n").filter((l) => containsPrice(l)),
  ...PRICING_FIGURES.filter((f) => SYSTEM_PROMPT.includes(f)),
];
// The one allowed figure is the caller's own volunteered budget in the tone example.
const real = leaks.filter((l) => !l.startsWith("Caller: My budget"));
if (real.length) {
  console.error("Pricing leaked into the agent brief:\n" + real.join("\n"));
  process.exit(1);
}

const out = new URL("../../knowledge/", import.meta.url);
mkdirSync(out, { recursive: true });

const config = agentConfig();
writeFileSync(new URL("vaani-agent.json", out), JSON.stringify(config, null, 2));
writeFileSync(
  new URL("vaani-agent.md", out),
  `# Aangan Concierge — voice agent brief\n\nGenerated from services.md, qualified.md and the pricing rule. Contains no pricing figures (checked on build).\n\n## Greeting\n\n> ${GREETING}\n\n## System prompt\n\n\`\`\`\n${SYSTEM_PROMPT}\n\`\`\`\n\n## Data collected after each call\n\n${DATA_POINTS.map((d) => `- \`${d.name}\`: ${d.prompt}`).join("\n")}\n\n## Call outcomes\n\n${DISPOSITIONS.map((d) => `- \`${d.name}\`: ${d.prompt}`).join("\n")}\n`,
);
console.log(`Agent brief written (${SYSTEM_PROMPT.length} chars). No pricing figures found.`);
