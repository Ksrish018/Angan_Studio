import { sql } from "./db";

// Studio settings Nikhil edits on the Settings page. Environment variables are only the first-run defaults.
export type Settings = {
  officeStart: number;          // hour, IST
  officeEnd: number;            // hour, IST
  founderEmail: string;         // weekly digest and failure alerts
  frontDeskEmail: string;       // copied on every designer handoff
  seniorPhone: string;          // who takes existing-client escalations
  handoffInbox: string;         // while Aangan's email domain isn't verified, every handoff goes here
  vaaniInrPerMin: number;
  vaaniInrPerCredit: number | null;
  retentionDays: number;        // transcripts and recordings are cleared after this
};

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const DEFAULTS: Settings = {
  officeStart: 10,
  officeEnd: 19,
  founderEmail: process.env.FOUNDER_EMAIL ?? "",
  frontDeskEmail: process.env.FRONT_DESK_EMAIL ?? "",
  seniorPhone: process.env.SENIOR_PHONE ?? "",
  handoffInbox: process.env.HANDOFF_OVERRIDE_TO ?? "",
  vaaniInrPerMin: num(process.env.VAANI_INR_PER_MIN, 10),
  vaaniInrPerCredit: process.env.VAANI_INR_PER_CREDIT ? Number(process.env.VAANI_INR_PER_CREDIT) : null,
  retentionDays: 90,
};

export async function getSettings(): Promise<Settings> {
  const rows = (await sql`select key, value from settings`) as { key: keyof Settings; value: unknown }[];
  const s = { ...DEFAULTS } as Record<string, unknown>;
  for (const r of rows) if (r.key in DEFAULTS) s[r.key] = r.value;
  return s as Settings;
}

export async function saveSettings(patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULTS) || value === undefined) continue;
    await sql`insert into settings (key, value, updated_at) values (${key}, ${JSON.stringify(value)}, now())
              on conflict (key) do update set value = excluded.value, updated_at = now()`;
  }
}

// Small key-value markers for background jobs (e.g. when reconciliation last ran).
export async function getMarker(key: string): Promise<string | null> {
  const [r] = (await sql`select value from settings where key = ${`_${key}`}`) as { value: string }[];
  return r?.value ?? null;
}
export async function setMarker(key: string, value: string) {
  await sql`insert into settings (key, value, updated_at) values (${`_${key}`}, ${JSON.stringify(value)}, now())
            on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

export function isAfterHours(d: Date, s: Pick<Settings, "officeStart" | "officeEnd">) {
  const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours() + ist.getMinutes() / 60;
  return ist.getDay() === 0 || h < s.officeStart || h >= s.officeEnd;
}
