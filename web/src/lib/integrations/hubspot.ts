// HubSpot CRM v3 with a service key scoped to contacts + deals only.
const API = "https://api.hubapi.com/crm/v3";

async function hs(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

type Stage = { id: string; label: string; displayOrder: number };
let stageCache: { pipeline: string; stage: string } | null = null;

// Accounts name their deal stages differently, so find the right one instead of assuming HubSpot's defaults:
// a stage that sounds like a booked consultation, else "Lead Captured"/"Qualified", else the second stage.
export async function bookedStage(): Promise<{ pipeline: string; stage: string }> {
  if (process.env.HUBSPOT_DEAL_STAGE) return { pipeline: process.env.HUBSPOT_PIPELINE ?? "default", stage: process.env.HUBSPOT_DEAL_STAGE };
  if (stageCache) return stageCache;
  const body = (await hs("/pipelines/deals")) as { results: { id: string; stages: Stage[] }[] };
  const pipeline = body.results.find((p) => p.id === "default") ?? body.results[0];
  const stages = [...pipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder);
  const pick =
    stages.find((s) => /appointment|consult|scheduled|booked/i.test(s.label)) ??
    stages.find((s) => /lead captured|qualified/i.test(s.label)) ??
    stages[Math.min(1, stages.length - 1)];
  stageCache = { pipeline: pipeline.id, stage: pick.id };
  return stageCache;
}

export type CrmLead = {
  name: string | null;
  phone: string | null;
  locality: string | null;
  summary: string;
  consultationAt: Date | null;
  propertyType: string | null;
};

export async function syncLead(lead: CrmLead): Promise<{ contactId: string; dealId: string } | null> {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return null;
  const [firstname, ...rest] = (lead.name ?? "Caller").split(" ");

  let contactId: string | undefined;
  if (lead.phone) {
    const found = await hs("/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: lead.phone }] }], limit: 1 }),
    });
    contactId = found.results?.[0]?.id;
  }
  contactId ??= (await hs("/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties: { firstname, lastname: rest.join(" "), phone: lead.phone ?? "", city: lead.locality ?? "" } }),
  })).id as string;

  const { pipeline, stage } = await bookedStage();
  const deal = await hs("/objects/deals", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        dealname: [lead.name, lead.propertyType, lead.locality?.split(",")[0]].filter(Boolean).join(" · ") || "New enquiry",
        pipeline,
        dealstage: stage,
        description: lead.summary,
        ...(lead.consultationAt ? { closedate: lead.consultationAt.toISOString() } : {}),
      },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
    }),
  });
  return { contactId, dealId: deal.id };
}
