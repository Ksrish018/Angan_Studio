import { Resend } from "resend";

export type Handoff = {
  leadId: number;
  designerName: string;
  designerEmail: string;
  name: string | null;
  phone: string | null;
  locality: string | null;
  propertyType: string | null;
  carpetSqft: number | null;
  scope: string | null;
  timeline: string | null;
  decisionMaker: string | null;
  source: string | null;
  consultationAt: Date | null;
  consultationMode: string | null;
  flags: string[];
  summary: string;
  designerNotes: string | null;
};

const FLAG_COPY: Record<string, string> = {
  asked_price: "Asked about pricing. Come ready to talk numbers.",
  frustrated: "Caller was frustrated about a delay. Be warm and prompt.",
  vip_referral: "Referred by someone close to the studio.",
  decider_unconfirmed: "Decision-maker not confirmed on the call. Please check at the start.",
  not_booked: "No slot was booked on the call. Front desk will confirm a time.",
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const fmtSlot = (d: Date | null) =>
  d
    ? d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })
    : "To be scheduled";

export function handoffSubject(h: Handoff) {
  return [h.name ?? "New enquiry", h.propertyType, h.locality?.split(",")[0], fmtSlot(h.consultationAt)].filter(Boolean).join(" · ");
}

// ---------- Calendar invite for the designer ----------

const CONSULT_MINUTES = 60;
const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const NL = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);
const BS = String.fromCharCode(92);
// iCalendar text escaping (RFC 5545): backslash, semicolon, comma and line breaks.
const icsText = (s: string) =>
  s.split(BS).join(BS + BS).split(";").join(BS + ";").split(",").join(BS + ",").split(CRLF).join(BS + "n").split(NL).join(BS + "n");

// RFC 5545: lines longer than 75 characters continue on the next line, indented by one space.
function fold(line: string) {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += i === 0 ? 74 : 73) parts.push(line.slice(i, i + (i === 0 ? 74 : 73)));
  return parts.join(CRLF + " ");
}

function eventTitle(h: Handoff) {
  return `Aangan consultation · ${[h.name ?? "New client", h.propertyType, h.locality?.split(",")[0]].filter(Boolean).join(" · ")}`;
}

function eventDetails(h: Handoff, appUrl: string) {
  return [
    h.consultationMode === "site_visit" ? "Site visit" : h.consultationMode === "studio" ? "At the studio" : "Mode to confirm",
    h.phone ? `Client phone: ${h.phone}` : null,
    h.scope ? `Scope: ${h.scope}` : null,
    h.timeline ? `Timeline: ${h.timeline}` : null,
    `Brief: ${appUrl}/leads/${h.leadId}`,
    "Pricing is discussed in person. No figures were shared on the call.",
  ].filter(Boolean).join(NL);
}

// A standard .ics invite: one tap adds the visit to Google, Outlook or Apple Calendar.
export function consultationIcs(h: Handoff, appUrl: string): string | null {
  if (!h.consultationAt) return null;
  const end = new Date(h.consultationAt.getTime() + CONSULT_MINUTES * 60_000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Aangan Concierge//Consultations//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:lead-${h.leadId}@aangan-concierge`,
    `DTSTAMP:${icsTime(new Date())}`,
    `DTSTART:${icsTime(h.consultationAt)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsText(eventTitle(h))}`,
    `LOCATION:${icsText(h.locality ?? "To confirm with the client")}`,
    `DESCRIPTION:${icsText(eventDetails(h, appUrl))}`,
    `URL:${appUrl}/leads/${h.leadId}`,
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Aangan consultation in 1 hour", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].map(fold).join(CRLF);
}

export function googleCalendarLink(h: Handoff, appUrl: string): string | null {
  if (!h.consultationAt) return null;
  const end = new Date(h.consultationAt.getTime() + CONSULT_MINUTES * 60_000);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(h),
    dates: `${icsTime(h.consultationAt)}/${icsTime(end)}`,
    details: eventDetails(h, appUrl),
    location: h.locality ?? "",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function handoffHtml(h: Handoff, appUrl: string) {
  const rows: [string, string | null][] = [
    ["Where", h.locality],
    ["Property", [h.propertyType, h.carpetSqft ? `${h.carpetSqft.toLocaleString("en-IN")} sq ft carpet` : null].filter(Boolean).join(" · ") || null],
    ["Scope", h.scope],
    ["Timeline", h.timeline],
    ["Decides", h.decisionMaker],
    ["Came via", h.source],
    ["Phone", h.phone],
    ["Consultation", `${fmtSlot(h.consultationAt)}${h.consultationMode === "site_visit" ? " · site visit" : h.consultationMode === "studio" ? " · at the studio" : ""}`],
  ];
  const facts = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) => `<tr><td style="padding:7px 0;color:#7A7064;font-size:13px;width:120px;vertical-align:top">${k}</td>
<td style="padding:7px 0;color:#1F1B16;font-size:14px">${esc(v!)}</td></tr>`,
    )
    .join("");
  const flags = h.flags
    .filter((f) => FLAG_COPY[f])
    .map((f) => `<p style="margin:0 0 6px;font-size:13px;color:#8A3E1F">● ${FLAG_COPY[f]}</p>`)
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#F6F2EC;font-family:Inter,Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F2EC;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF9;border:1px solid #E7DFD3;border-radius:14px">
<tr><td style="padding:28px 32px 8px">
  <p style="margin:0;font-family:Georgia,serif;font-size:15px;letter-spacing:.18em;color:#B5552E">AANGAN</p>
  <p style="margin:18px 0 4px;font-size:13px;color:#7A7064">New consultation for ${esc(h.designerName)}</p>
  <h1 style="margin:0;font-family:Georgia,serif;font-weight:400;font-size:24px;line-height:1.3;color:#1F1B16">${esc(handoffSubject(h))}</h1>
</td></tr>
<tr><td style="padding:16px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EFE8DD">${facts}</table></td></tr>
${flags ? `<tr><td style="padding:4px 32px 8px">${flags}</td></tr>` : ""}
<tr><td style="padding:8px 32px">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;color:#7A7064">FROM THE CALL</p>
  <p style="margin:0;font-size:14px;line-height:1.65;color:#1F1B16">${esc(h.summary)}</p>
  ${h.designerNotes ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.65;color:#4A433B">${esc(h.designerNotes)}</p>` : ""}
</td></tr>
<tr><td style="padding:20px 32px 8px">
  <a href="${appUrl}/leads/${h.leadId}" style="display:inline-block;background:#1F1B16;color:#FFFDF9;text-decoration:none;font-size:14px;padding:11px 20px;border-radius:999px;margin:0 8px 8px 0">Open brief</a>
  ${googleCalendarLink(h, appUrl) ? `<a href="${esc(googleCalendarLink(h, appUrl)!)}" style="display:inline-block;border:1px solid #1F1B16;color:#1F1B16;text-decoration:none;font-size:14px;padding:10px 19px;border-radius:999px;margin:0 0 8px">Add to Google Calendar</a>` : ""}
  ${h.consultationAt ? `<p style="margin:6px 0 0;font-size:12px;color:#7A7064">Using Outlook or Apple Calendar? Open the attached invite (consultation.ics).</p>` : `<p style="margin:6px 0 0;font-size:12px;color:#7A7064">The time isn't fixed yet. The front desk will confirm it with the client.</p>`}
</td></tr>
<tr><td style="padding:18px 32px 28px"><p style="margin:0;font-size:12px;color:#7A7064;font-style:italic">Pricing is yours to discuss at the consultation. No figures were shared on the call.</p></td></tr>
</table></td></tr></table></body></html>`;
}

// `inbox` overrides the designer's address while Aangan's email domain isn't verified (Resend's test sender
// can only deliver to the account owner). `cc` is the front desk.
export async function sendHandoff(h: Handoff, appUrl: string, route: { inbox?: string; cc?: string } = {}) {
  if (!process.env.RESEND_API_KEY) throw new Error("Resend key missing");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = route.inbox || h.designerEmail;
  const ics = consultationIcs(h, appUrl);
  const { data, error } = await resend.emails.send({
    from: `Aangan Concierge <${process.env.RESEND_FROM ?? "onboarding@resend.dev"}>`,
    to,
    cc: route.cc && !route.inbox ? [route.cc] : undefined,
    subject: route.inbox ? `[for ${h.designerName}] ${handoffSubject(h)}` : handoffSubject(h),
    html: handoffHtml(h, appUrl),
    attachments: ics ? [{ filename: "consultation.ics", content: Buffer.from(ics).toString("base64"), contentType: "text/calendar; charset=utf-8; method=PUBLISH" }] : undefined,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { id: data?.id, to, invite: !!ics };
}
