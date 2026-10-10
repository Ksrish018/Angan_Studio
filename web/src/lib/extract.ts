import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { SERVICES_BRIEF } from "@/knowledge/services";

export const ExtractionSchema = z.object({
  name: z.string().nullable().describe("Caller's name, or null"),
  locality: z.string().nullable().describe("Locality/area and city of the site, e.g. 'Kothrud, Pune'"),
  property_type: z.string().nullable().describe("e.g. '3BHK apartment', 'villa', 'office', 'restaurant'"),
  carpet_sqft: z.number().int().nullable().describe("Carpet area in sq ft if stated"),
  scope: z.string().nullable().describe("What they want done, in a short phrase"),
  project_kind: z.enum([
    "residential_full", "residential_partial", "single_room", "commercial_office", "advice_only", "out_of_scope", "unknown",
  ]).describe(
    "residential_full = whole home; residential_partial = 2+ rooms or a floor (e.g. kitchen + bedroom); single_room = one room; " +
    "commercial_office = office/clinic/studio/coworking space of any size; advice_only = wants ideas, colours, styling or a visit without execution; " +
    "out_of_scope = restaurants, cafes, hotels, retail, gyms; unknown = no project described, or only 'exploring' with nothing concrete",
  ),
  timeline: z.string().nullable().describe("Their timeline in their words, e.g. 'done by March'"),
  weeks_to_deadline: z.number().int().nullable().describe("Weeks from the call date until the project must be COMPLETE, if a hard deadline was given; null if flexible or unknown"),
  decision_maker: z.string().nullable().describe("Who decides, e.g. 'Caller and husband, husband agreed'"),
  decision_maker_status: z.enum(["decider", "authorised", "unclear"]),
  source: z.string().nullable().describe("How they found Aangan, e.g. 'Referral from Shruti Joshi (Aundh client)', 'Instagram'"),
  budget_volunteered: z.string().nullable().describe("Budget exactly as the CALLER stated it, or null if they did not volunteer one"),
  budget_max_inr: z.number().nullable().describe("Upper end of the caller's volunteered budget in rupees, or null"),
  is_existing_client_issue: z.boolean().describe("True if the caller is an existing client with a complaint or issue about an ongoing project"),
  flags: z.array(z.enum(["asked_price", "frustrated", "vip_referral"])).describe(
    "asked_price: caller asked about cost/rates. frustrated: caller upset about delays or no reply. vip_referral: referred by someone personally close to the founder Nikhil (a friend or family), not just any past client",
  ),
  consultation_mode: z.enum(["site_visit", "studio", "unknown"]),
  summary: z.string().describe("3-4 sentence brief for the designer: who, what, where, when, anything to prepare. NEVER include any price, cost, rate or rupee figure."),
  designer_notes: z.string().describe("1-2 short lines of things the designer should know (sensitivities, preferences). No prices."),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM = `You are the intake analyst for Aangan Studio, an interior design studio in Pune.

About the studio:
${SERVICES_BRIEF}

Read one enquiry (a phone transcript, a WhatsApp thread or a web form) and extract facts exactly as the enquirer stated them.
- Only the enquirer's words count as facts. Lines from the studio (AGENT or Front Desk) are context, not facts about the project.
- Do not invent anything. Use null when something was not said.
- weeks_to_deadline: only for a hard completion date (e.g. "before Diwali", "guests arrive in 3 weeks", "operational by January 15"). Count weeks from the enquiry date. For "no rush", "flexible" or a start date only, use null.
- A move-in or possession date is a start date, not a completion deadline, unless they say the work must be finished by then.
- Never write any price, cost estimate, rate or rupee amount in summary or designer_notes, even if the enquirer mentioned one.`;

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export type ExtractResult = { data: Extraction; inputTokens: number; outputTokens: number };

export async function extract(text: string, date: Date, channel = "phone call"): Promise<ExtractResult> {
  const res = await ai().models.generateContent({
    model: GEMINI_MODEL,
    contents: `Channel: ${channel}\nEnquiry date: ${date.toDateString()}\n\nEnquiry:\n${text}`,
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(ExtractionSchema),
    },
  });
  const data = ExtractionSchema.parse(JSON.parse(res.text ?? "{}"));
  return {
    data,
    inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
  };
}
