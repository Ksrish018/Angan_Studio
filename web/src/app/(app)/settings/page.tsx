import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { viewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { healthChecks } from "@/lib/health";
import { PageHeader, when } from "@/components/ui";
import { GoLiveForm, StudioSettingsForm } from "@/components/settings-forms";

const DOT = { ok: "bg-sage", warn: "bg-ochre", error: "bg-rose-ink" } as const;
const WORD = { ok: "Working", warn: "Needs setup", error: "Not working" } as const;

export default async function SettingsPage() {
  await connection();
  const me = await viewer();
  if (me.role !== "founder") redirect(me.role === "designer" ? "/me" : "/review");
  const [s, health, [counts]] = await Promise.all([
    getSettings(),
    healthChecks(),
    sql`select (select count(*)::int from calls where source = 'replay') as replay, (select count(*)::int from designers where is_demo) as demo`.then((r) => r as { replay: number; demo: number }[]),
  ]);
  const appUrl = process.env.APP_URL ?? "";

  return (
    <div className="wrap">
      <PageHeader eyebrow="Settings" title="How the studio runs." />

      <section className="mb-12">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-serif text-[30px]">Connections</h2>
          <span className="text-[13px] text-stone">Checked just now · refresh to check again</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {health.map((h) => (
            <div key={h.service} className="card p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[16px]">{h.label}</p>
                <span className="flex items-center gap-2 text-[12px] text-ink-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${DOT[h.state]}`} />{WORD[h.state]}
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-stone">{h.detail}</p>
              {(h.lastOk || h.lastError) && (
                <p className="mt-3 border-t border-hairline-2 pt-3 text-[12px] text-stone">
                  {h.lastOk && <>Last success {when(h.lastOk)}. </>}
                  {h.lastError && <span className="text-rose-ink">Last error: {h.lastError.slice(0, 120)}</span>}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="card mt-4 p-6 text-[14px] leading-relaxed">
          <p className="eyebrow mb-2">Vaani webhook</p>
          <p>
            In Vaani, go to Settings → Webhooks and add <span className="rounded bg-linen px-1.5 py-0.5 font-mono text-[13px]">{appUrl || "https://<your app>"}/api/webhooks/vaani?token=…</span>.
            The secret token is kept in the server settings on Vercel (VAANI_WEBHOOK_TOKEN), not shown here.
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2"><StudioSettingsForm s={s} /></div>
        <div className="space-y-5">
          <div className="card p-7">
            <h2 className="font-serif text-[26px]">Reports</h2>
            <ul className="mt-5 space-y-3 text-[14px]">
              <li><a href="/api/export" className="underline underline-offset-4">Download all enquiries (Excel / CSV)</a></li>
              <li><a href="/api/digest" target="_blank" className="underline underline-offset-4">Preview the Monday digest</a></li>
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-stone">The digest is emailed every Monday at 9:00 to the founder email. Internal pricing is never in exports or emails.</p>
          </div>
          <GoLiveForm replayCalls={counts.replay} demoDesigners={counts.demo} />
        </div>
      </div>
    </div>
  );
}
