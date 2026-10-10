// The Vaani agent configuration, shaped like docs.vaanivoice.ai expects
// (POST /api/create-agent config, PATCH /persona, /training, /analysis).
import { DATA_POINTS, DISPOSITIONS, FAQ, GREETING, SYSTEM_PROMPT } from "./agent";

export function agentConfig() {
  return {
    persona: {
      identity: {
        system_prompt: SYSTEM_PROMPT,
        greeting_message: { agent_message: GREETING, agent_speech_delay: 1, interruptible: true, let_user_speak_first: false },
      },
      senses_capabilities: { language: "en", auto_detect: true },
    },
    training: {
      know_how: {
        faq: Object.fromEntries(FAQ.map((f) => [f.q, f.a])),
        // Vaani's custom_rules object shape is undocumented, so the hard rules (CUSTOM_RULES) live in the system prompt.
        guardrails: { level: "strict", custom_rules: [] },
      },
    },
    analysis: {
      extraction: { data_collection: { enabled: true, data_points: DATA_POINTS } },
      evaluations: { dispositions: { enabled: true, prompt_based: DISPOSITIONS } },
    },
  };
}
