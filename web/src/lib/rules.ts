import {
  COMMERCIAL_MAX_SQFT, COMMERCIAL_MIN_SQFT, EXCLUDED_AREAS, MIN_LEAD_WEEKS, OUT_OF_SCOPE_KINDS, SERVICE_AREAS,
} from "@/knowledge/services";
import { budgetFloor } from "@/knowledge/pricing";
import type { Extraction } from "./extract";

export type Verdict = "pass" | "fail" | "unclear";
export type Criterion = { verdict: Verdict; reason: string };
export type Criteria = {
  real_project: Criterion;
  service_area: Criterion;
  timeline: Criterion;
  budget: Criterion;
  decision_maker: Criterion;
};
export type Outcome = "qualified" | "needs_info" | "declined" | "escalation";

export type Decision = {
  outcome: Outcome;
  criteria: Criteria;
  declineReason: string | null;
  flags: string[];
  inServiceArea: boolean | null;
  needsReview: boolean;
};

const has = (text: string | null | undefined, words: string[]) => {
  const t = (text ?? "").toLowerCase();
  return words.find((w) => t.includes(w)) ?? null;
};

function realProject(x: Extraction): Criterion {
  if (x.project_kind === "advice_only")
    return { verdict: "fail", reason: "Wants advice or ideas only. Our minimum is a room redesign with execution." };
  const oos = x.project_kind === "out_of_scope" ? has(`${x.property_type} ${x.scope}`, OUT_OF_SCOPE_KINDS) ?? "this type of space" : null;
  if (oos) return { verdict: "fail", reason: `Out of scope: ${oos} interiors are not something we take on.` };
  if (x.project_kind === "commercial_office" && x.carpet_sqft) {
    if (x.carpet_sqft < COMMERCIAL_MIN_SQFT)
      return { verdict: "fail", reason: `Commercial space of ${x.carpet_sqft} sq ft is below our minimum scope.` };
    if (x.carpet_sqft > COMMERCIAL_MAX_SQFT)
      return { verdict: "unclear", reason: `Office of ${x.carpet_sqft} sq ft is above our usual ~3,000 sq ft. Principal to decide.` };
  }
  if (x.project_kind === "unknown") return { verdict: "unclear", reason: "Scope not clear from the call." };
  return { verdict: "pass", reason: "Design and execution project within our services." };
}

function serviceArea(x: Extraction): { c: Criterion; inArea: boolean | null } {
  const where = `${x.locality ?? ""}`;
  const excluded = has(where, EXCLUDED_AREAS);
  if (excluded) return { c: { verdict: "fail", reason: `${x.locality} is outside Pune and PCMC.` }, inArea: false };
  const ok = has(where, SERVICE_AREAS);
  if (ok) return { c: { verdict: "pass", reason: `${x.locality} is in our service area.` }, inArea: true };
  if (!x.locality) return { c: { verdict: "unclear", reason: "Location not captured." }, inArea: null };
  return { c: { verdict: "unclear", reason: `Couldn't confirm ${x.locality} is in Pune/PCMC.` }, inArea: null };
}

function timeline(x: Extraction): Criterion {
  if (x.weeks_to_deadline == null)
    return x.timeline
      ? { verdict: "pass", reason: `Flexible timeline: ${x.timeline}.` }
      : { verdict: "unclear", reason: "Timeline not captured." };
  if (x.weeks_to_deadline < MIN_LEAD_WEEKS)
    return { verdict: "fail", reason: `Needs completion in ~${x.weeks_to_deadline} weeks. Design alone takes 3–4 weeks.` };
  return { verdict: "pass", reason: `About ${x.weeks_to_deadline} weeks to the target date.` };
}

function budget(x: Extraction): Criterion {
  if (x.budget_max_inr == null) return { verdict: "pass", reason: "Budget not mentioned. The designer will establish fit." };
  const floor = budgetFloor(x.project_kind, x.carpet_sqft);
  if (floor && x.budget_max_inr < floor * 0.5)
    return { verdict: "fail", reason: "Volunteered budget is well below what this scope costs with us." };
  return { verdict: "pass", reason: "Volunteered budget is broadly in range." };
}

function decisionMaker(x: Extraction): Criterion {
  if (x.decision_maker_status === "decider") return { verdict: "pass", reason: x.decision_maker ?? "Caller decides." };
  if (x.decision_maker_status === "authorised") return { verdict: "pass", reason: x.decision_maker ?? "Caller is authorised." };
  return { verdict: "unclear", reason: x.decision_maker ?? "Decision-maker not confirmed. Designer to check." };
}

// Rules from qualified.md:
// - fails any criterion -> close gracefully (front desk reviews every decline)
// - unclear on 1, 2 or 3 -> needs one more question (front desk follow-up)
// - unclear on 4 or 5 -> treat as qualified and note it
export function decide(x: Extraction): Decision {
  const area = serviceArea(x);
  const criteria: Criteria = {
    real_project: realProject(x),
    service_area: area.c,
    timeline: timeline(x),
    budget: budget(x),
    decision_maker: decisionMaker(x),
  };
  const flags = new Set<string>(x.flags);
  if (criteria.decision_maker.verdict === "unclear") flags.add("decider_unconfirmed");

  if (x.is_existing_client_issue) {
    return { outcome: "escalation", criteria, declineReason: null, flags: [...flags], inServiceArea: area.inArea, needsReview: true };
  }

  const fails = (Object.entries(criteria) as [keyof Criteria, Criterion][]).filter(([, c]) => c.verdict === "fail");
  if (fails.length) {
    const reasonLabel: Record<keyof Criteria, string> = {
      real_project: x.project_kind === "advice_only" ? "Advice only" : "Out of scope",
      service_area: "Outside service area",
      timeline: "Timeline too short",
      budget: "Budget well below scope",
      decision_maker: "No decision-maker",
    };
    return {
      outcome: "declined", criteria, declineReason: reasonLabel[fails[0][0]],
      flags: [...flags], inServiceArea: area.inArea, needsReview: true,
    };
  }

  const earlyUnclear = (["real_project", "service_area", "timeline"] as const).some((k) => criteria[k].verdict === "unclear");
  if (earlyUnclear) {
    return { outcome: "needs_info", criteria, declineReason: null, flags: [...flags], inServiceArea: area.inArea, needsReview: true };
  }

  return {
    outcome: "qualified", criteria, declineReason: null, flags: [...flags], inServiceArea: area.inArea,
    needsReview: flags.has("frustrated"),
  };
}

// Pricing guardrail for any AI-written text: no rupee amounts, ranges or per-sq-ft figures.
const PRICE_PATTERNS = [
  /₹\s?\d/,
  /\brs\.?\s?\d/i,
  /\binr\s?\d/i,
  /\d[\d,.]*\s?(lakh|lac|lakhs|crore|cr|k)\b/i,
  /per\s?(sq\.?\s?ft|square\s?f(oo|ee)t)/i,
];

export function containsPrice(text: string): boolean {
  return PRICE_PATTERNS.some((p) => p.test(text));
}

export function scrubPrice(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !containsPrice(s))
    .join(" ");
}
