import Image from "next/image";
import { redirect } from "next/navigation";
import { designers } from "@/lib/queries";
import { viewer, canManage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { loadStarterTeam, updateDesigner } from "@/app/actions";
import { PageHeader, when } from "@/components/ui";
import { AddDesignerForm } from "@/components/team-forms";

const FOCUS: [RegExp, string][] = [
  [/villa|house|bungalow/i, "/rooms/villa.jpg"],
  [/office|clinic|commercial|studio/i, "/rooms/office.jpg"],
  [/kitchen|wardrobe/i, "/rooms/kitchen.jpg"],
  [/bed/i, "/rooms/bedroom.jpg"],
  [/dining|living/i, "/rooms/dining.jpg"],
];
const FALLBACK = ["/rooms/apartment.jpg", "/rooms/living.jpg", "/rooms/dining.jpg", "/rooms/kitchen.jpg", "/rooms/bedroom.jpg"];

function cover(specialty: string | null, principal: boolean, i: number) {
  if (principal && !specialty) return "/rooms/villa.jpg";
  return FOCUS.find(([re]) => specialty && re.test(specialty))?.[1] ?? FALLBACK[i % FALLBACK.length];
}

// Kept here: constants exported from a client module arrive as references in a server component.
const field = "w-full rounded-xl border border-hairline bg-paper px-3.5 py-2 text-[14px] outline-none transition-colors placeholder:text-stone focus:border-ink";
const btn = "rounded-full border border-hairline px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:border-ink hover:text-ink";

export default async function Team() {
  const me = await viewer();
  if (me.role === "designer") redirect("/me");
  const [rows, s] = await Promise.all([designers(), getSettings()]);
  const demo = rows.some((d) => d.is_demo);
  const manage = canManage(me);
  const available = rows.filter((d) => !d.paused).length;

  return (
    <div className="wrap">
      <PageHeader eyebrow="Studio" title="The people who design." />
      <p className="-mt-4 mb-10 max-w-2xl text-[15px] leading-relaxed text-stone">
        {available} designer{available === 1 ? "" : "s"} taking new consultations. Concierge gives each booking to whoever has the lightest load,
        and close referrals to the principal designer.
        {demo && " Cards marked Placeholder are the starter team: you can assign consultations to them now, and replace each email with the designer's real one under Edit."}
      </p>

      {manage && (
        <div className="mb-12 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2"><AddDesignerForm /></div>
          <div className="card p-7">
            <h2 className="font-serif text-[22px]">Also on the team</h2>
            <dl className="mt-5 space-y-4 text-[14px]">
              <div><dt className="eyebrow">Front desk (copied on briefs)</dt><dd className="mt-1">{s.frontDeskEmail || <span className="text-stone">Not set</span>}</dd></div>
              <div><dt className="eyebrow">Senior lead for escalations</dt><dd className="mt-1">{s.seniorPhone || <span className="text-stone">Not set</span>}</dd></div>
              <div><dt className="eyebrow">Founder (alerts and Monday digest)</dt><dd className="mt-1">{s.founderEmail || <span className="text-stone">Not set</span>}</dd></div>
            </dl>
            {me.role === "founder" && <a href="/settings" className="mt-6 inline-block text-[13px] text-ink underline underline-offset-4">Change in Settings</a>}
          </div>
        </div>
      )}

      {rows.length === 0 && manage && (
        <form action={loadStarterTeam} className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-7">
          <div>
            <h2 className="font-serif text-[22px]">No designers yet</h2>
            <p className="mt-1 max-w-xl text-[14px] text-stone">Add your designers above, or load the six-person starter team to assign consultations straight away.</p>
          </div>
          <button className="rounded-full bg-ink px-5 py-2.5 text-[14px] text-paper transition-opacity hover:opacity-85">Load starter team</button>
        </form>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((d, i) => (
          <article key={d.id} className={`reveal card group overflow-hidden ${d.paused ? "opacity-70" : ""}`}>
            <div className="relative aspect-[16/9] overflow-hidden">
              <Image src={cover(d.specialty, d.is_principal, i)} alt="" fill sizes="(min-width:1280px) 400px, 50vw" className={`object-cover transition-transform duration-700 group-hover:scale-105 ${d.paused ? "grayscale" : ""}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <div className="absolute bottom-4 left-5 flex h-12 w-12 items-center justify-center rounded-full bg-paper font-serif text-[18px] text-terracotta">
                {d.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
              </div>
              <div className="absolute right-4 top-4 flex gap-2">
                {d.is_demo && <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm">Placeholder</span>}
                {d.paused && <span className="rounded-full bg-paper px-2.5 py-1 text-[12px] text-ochre-ink">Paused</span>}
                {d.is_principal && <span className="rounded-full bg-paper px-2.5 py-1 text-[12px] text-terracotta-ink">Principal</span>}
              </div>
            </div>
            <div className="p-6">
              <p className="font-serif text-[24px]">{d.name}</p>
              <p className="truncate text-[13px] text-stone">{d.specialty ?? "All kinds of homes"} · {d.email}</p>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-hairline-2 pt-4">
                <div><p className="eyebrow">Upcoming</p><p className="mt-1 font-serif text-[26px] tabular">{d.upcoming}</p></div>
                <div><p className="eyebrow">Proposals</p><p className="mt-1 font-serif text-[26px] tabular">{d.proposals}</p></div>
                <div><p className="eyebrow">Next</p><p className="mt-2 text-[13px] tabular">{d.next_at ? when(d.next_at, { weekday: "short", hour: undefined, minute: undefined }) : "—"}</p></div>
              </div>
              {manage && (
                <form action={updateDesigner} className="mt-5 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={d.id} />
                  <button name="op" value={d.paused ? "resume" : "pause"} className={btn}>{d.paused ? "Resume" : "Pause (on leave)"}</button>
                  <button name="op" value="principal" className={btn}>{d.is_principal ? "Not principal" : "Make principal"}</button>
                  <button name="op" value="remove" className={`${btn} hover:border-rose-ink hover:text-rose-ink`}>Remove</button>
                </form>
              )}
              {manage && (
                <details className="mt-3 group/edit">
                  <summary className="cursor-pointer list-none text-[13px] text-ink-2 underline underline-offset-4">{d.is_demo ? "Edit · add real email" : "Edit name or email"}</summary>
                  <form action={updateDesigner} className="mt-3 grid gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <input name="name" defaultValue={d.name} aria-label="Name" className={field} autoComplete="off" />
                    <input name="email" type="email" defaultValue={d.is_demo ? "" : d.email} placeholder={d.is_demo ? "name@aanganstudio.in" : undefined} aria-label="Email" className={field} autoComplete="off" />
                    <button name="op" value="edit" className={`${btn} justify-self-start`}>Save</button>
                  </form>
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
