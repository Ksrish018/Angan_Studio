// Unit rates in rupees. Voice rates come from Settings; Gemini rates are estimates until invoices confirm them.
const num = (v: string | undefined, d: number) => (v ? Number(v) : d);

const GEMINI = {
  inrPer1kInput: num(process.env.GEMINI_INR_PER_1K_INPUT, 0.026),
  inrPer1kOutput: num(process.env.GEMINI_INR_PER_1K_OUTPUT, 0.21),
};

export function voiceCost(durationSec: number, credits: number | null | undefined, rates: { vaaniInrPerMin: number; vaaniInrPerCredit: number | null }) {
  if (credits != null && rates.vaaniInrPerCredit != null) {
    return { units: credits, unit: "credits", inr: credits * rates.vaaniInrPerCredit, estimated: false };
  }
  const minutes = durationSec / 60;
  return { units: Number(minutes.toFixed(2)), unit: "minutes", inr: minutes * rates.vaaniInrPerMin, estimated: true };
}

export function llmCost(inputTokens: number, outputTokens: number) {
  return {
    units: inputTokens + outputTokens,
    unit: "tokens",
    inr: (inputTokens / 1000) * GEMINI.inrPer1kInput + (outputTokens / 1000) * GEMINI.inrPer1kOutput,
    estimated: true,
  };
}
