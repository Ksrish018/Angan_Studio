import { Resend } from "resend";
import { sql } from "./db";
import { getSettings } from "./settings";

export type Service = "vaani" | "gemini" | "calcom" | "hubspot" | "resend" | "cron";

export async function logIntegration(service: Service, ok: boolean, detail?: string) {
  try {
    await sql`insert into integration_log (service, ok, detail) values (${service}, ${ok}, ${detail?.slice(0, 500) ?? null})`;
  } catch {
    /* logging must never break the pipeline */
  }
}

// Retries a flaky outside call (HubSpot, Resend) before giving up: 3 tries, 0.5s then 2s apart.
export async function withRetry<T>(service: Service, label: string, fn: () => Promise<T>): Promise<T> {
  const waits = [500, 2000];
  let last: unknown;
  for (let attempt = 0; attempt <= waits.length; attempt++) {
    try {
      const out = await fn();
      await logIntegration(service, true, label);
      return out;
    } catch (e) {
      last = e;
      if (attempt < waits.length) await new Promise((r) => setTimeout(r, waits[attempt]));
    }
  }
  await logIntegration(service, false, `${label}: ${String(last)}`);
  throw last;
}

// Emails Nikhil when something needs him. At most one alert per subject per hour.
export async function alertFounder(subject: string, body: string) {
  const s = await getSettings();
  const to = s.founderEmail || s.handoffInbox;
  if (!to || !process.env.RESEND_API_KEY) return;
  const [recent] = (await sql`
    select 1 from integration_log where service = 'resend' and detail = ${`alert: ${subject}`} and at > now() - interval '1 hour' limit 1`) as unknown[];
  if (recent) return;
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `Aangan Concierge <${process.env.RESEND_FROM ?? "onboarding@resend.dev"}>`,
      to,
      subject: `Concierge: ${subject}`,
      html: `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1f1b16">
        <p style="font-family:Georgia,serif;letter-spacing:.18em;color:#b5552e">AANGAN</p>
        <p><strong>${subject}</strong></p><p>${body}</p>
        <p><a href="${process.env.APP_URL ?? ""}/review">Open the review queue</a></p></div>`,
    });
    await logIntegration("resend", !error, `alert: ${subject}`);
  } catch (e) {
    await logIntegration("resend", false, `alert failed: ${String(e)}`);
  }
}
