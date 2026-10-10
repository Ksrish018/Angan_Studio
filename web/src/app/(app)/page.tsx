import Image from "next/image";
import Link from "next/link";
import { overview, leads, latestDay, bookedScopes, insights, type Range } from "@/lib/queries";
import { viewer, canSeeMoney } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { indicativeRange, type Kind } from "@/knowledge/pricing";
import { roomImage } from "@/lib/imagery";
import { BarList, DailyColumns, DayStrip, Funnel, HourChart, OutcomeMix } from "@/components/charts";
import { CountUp } from "@/components/motion";
import { HumanTag, OutcomePill, RangeTabs, inr, when } from "@/components/ui";

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const crore = (n: number) => (n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(1)} Cr` : `₹${Math.round(n / 100_000)} lakh`);

function Big({ label, children, note }: { label: string; children: React.ReactNode; note: string }) {
  return (
    <div className="reveal border-t border-hairline pt-6">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 font-serif text-[64px] leading-none md:text-[84px]">{children}</p>
      <p className="mt-4 max-w-[260px] text-[14px] leading-relaxed text-stone">{note}</p>
    </div>
  );
}

export default async function Overview({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const range = (["7d", "30d", "all"].includes(sp.range as string) ? sp.range : "all") as Range;
  const me = await viewer();
  if (me.role === "designer") redirect("/me");
  const [{ k, costs, hours, reasons, pending, priceSlips, liveCalls }, recent, booked, day, scopes, settings, ins] = await Promise.all([
    overview(range), leads({ limit: 6 }), leads({ outcome: "qualified", limit: 10 }), latestDay(), bookedScopes(range), getSettings(), insights(range),
  ]);
  const p = ins.pipeline;
  const stages = [
    { label: "Calls answered", note: "Every ring, any hour", n: p.calls },
    { label: "Real enquiries", note: "Caller spoke about a project", n: p.spoke },
    { label: "Good fit", note: "Passed Nikhil's checks, or nearly", n: p.fit },
    { label: "Consultation booked", note: "A slot in a designer's diary", n: p.booked },
    { label: "Consultation held", note: "Designer recorded the visit", n: p.held },
    { label: "Proposal sent", note: "Ready for HubSpot follow-up", n: p.proposals },
  ];
  const money = canSeeMoney(me);
  const band = { start: settings.officeStart, end: settings.officeEnd };

  const totalCost = costs.reduce((s, c) => s + c.inr, 0);
  const estimated = costs.some((c) => c.estimated);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const ranges = scopes.map((b) => indicativeRange(b.project_kind as Kind, b.carpet_sqft)).filter((r) => r != null);
  const pipeLow = ranges.reduce((s, r) => s + r.low, 0);
  const pipeHigh = ranges.reduce((s, r) => s + r.high, 0);

  const journey = [
    { img: "/rooms/phone.jpg", step: "01", title: "Answered in two rings", body: "Day or night, English or Hindi. Recording announced, every time.", stat: `${k.calls} calls · ${pct(k.after_hours, k.calls)}% after hours` },
    { img: "/rooms/studio.jpg", step: "02", title: "Checked against Nikhil's five rules", body: "Real project, Pune or PCMC, workable timeline, budget sense, the right person.", stat: `${k.qualified} fit · ${k.declined} kindly declined` },
    { img: "/rooms/consultation.jpg", step: "03", title: "Booked into a designer's calendar", body: "A slot on the call, never a price. Pricing waits for the site visit.", stat: `${k.booked} consultations · ${k.asked_price} asked about price` },
    { img: "/rooms/living.jpg", step: "04", title: "Designer walks in prepared", body: "The brief, the five checks and a starting palette, before the first hello.", stat: `${pending} waiting for a person` },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[88vh] min-h-[560px] overflow-hidden bg-hero">
        <div className="hero-img hero-drift absolute inset-0" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/65" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
        <div className="hero-copy wrap relative flex h-full flex-col justify-end pb-16 text-white md:pb-24">
          <p className="anim-fade-up text-[13px] uppercase tracking-[0.22em] text-white/80">{greeting()}, {me.name}</p>
          <h1 className="anim-fade-up mt-4 max-w-4xl font-serif text-[52px] leading-[1.02] md:text-[104px]" style={{ animationDelay: "120ms" }}>
            Every call,<br />answered.
          </h1>
          <p className="anim-fade-up mt-6 max-w-xl text-[17px] leading-relaxed text-white/85 md:text-[19px]" style={{ animationDelay: "240ms" }}>
            Concierge picks up Aangan&rsquo;s phone at any hour, checks each enquiry against Nikhil&rsquo;s rules,
            and hands designers a brief worth reading.
          </p>
          <div className="anim-fade-up mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "360ms" }}>
            <Link href="/leads" className="rounded-full bg-white px-5 py-2.5 text-[14px] text-black transition-opacity hover:opacity-90">See enquiries</Link>
            <Link href="/review" className="rounded-full border border-white/50 px-5 py-2.5 text-[14px] text-white backdrop-blur-sm transition-colors hover:bg-white/10">
              {pending} waiting for a person
            </Link>
          </div>
        </div>
      </section>

      <div className="wrap">
        {k.has_replay && (
          <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-stone">
            You&rsquo;re looking at a replay of September&rsquo;s 19 real phone enquiries, processed by Concierge as if it had answered them.
            Live calls appear here once the Vaani number is connected.
          </p>
        )}

        {/* By the numbers */}
        <section className="mt-20 md:mt-28">
          <div className="reveal flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-2xl font-serif text-[40px] leading-[1.05] md:text-[56px]">Nobody waits for a call back.</h2>
            <RangeTabs current={range} />
          </div>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <Big label="Calls answered" note={`All of them, median ${Math.round(k.median_answer)}s to pick up${k.has_replay ? " (simulated)" : ""}. In September ~48% went unanswered for two days.`}>
              <CountUp value={k.calls} />
            </Big>
            <Big label="Consultations booked" note={`${pct(k.booked, k.calls)}% of calls became a slot in a designer's calendar.`}>
              <CountUp value={k.booked} />
            </Big>
            <Big label="After hours" note={`${k.after_hours} call${k.after_hours === 1 ? "" : "s"} outside 10am–7pm, when the phone used to ring out.`}>
              <CountUp value={pct(k.after_hours, k.calls)} suffix="%" />
            </Big>
            {money ? (
              <Big label="Cost per booking" note={`${inr(totalCost)} in total for ${Math.round(k.seconds / 60)} call minutes${estimated ? ", at estimated rates" : ""}.`}>
                {k.booked ? <CountUp value={Math.round(totalCost / k.booked)} prefix="₹" /> : "—"}
              </Big>
            ) : (
              <Big label="Waiting for you" note="Declines, unclear calls, missed calls and complaints in the review queue.">
                <CountUp value={pending} />
              </Big>
            )}
          </div>
        </section>

        {/* Pipeline */}
        <section className="mt-28 md:mt-36">
          <div className="reveal">
            <p className="eyebrow">The pipeline</p>
            <h2 className="mt-3 max-w-3xl font-serif text-[40px] leading-[1.05] md:text-[56px]">From a ring to a proposal.</h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-stone">
              How many calls make it to each stage, and how many carry on to the next. Designers move a client forward when they mark the consultation.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-5">
            <div className="reveal card p-7 lg:col-span-3"><Funnel stages={stages} /></div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:col-span-2">
              <div className="reveal card p-7">
                <div className="mb-5 flex items-baseline justify-between">
                  <h3 className="font-serif text-[22px]">How calls ended</h3>
                  <span className="text-[12px] text-stone">{p.calls} calls</span>
                </div>
                <OutcomeMix data={ins.mix} />
              </div>
              <div className="reveal card p-7">
                <p className="eyebrow">Conversion</p>
                <p className="mt-3 font-serif text-[44px] leading-none tabular">{p.calls ? Math.round((p.booked / p.calls) * 100) : 0}%</p>
                <p className="mt-3 text-[14px] leading-relaxed text-stone">
                  of calls became a booked consultation{p.held ? `, and ${Math.round((p.proposals / p.held) * 100)}% of consultations held led to a proposal` : ""}.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Journey */}
        <section className="mt-28 md:mt-36">
          <p className="reveal eyebrow">How it works</p>
          <h2 className="reveal mt-3 max-w-3xl font-serif text-[40px] leading-[1.05] md:text-[56px]">From the first ring to the first site visit.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {journey.map((j) => (
              <article key={j.step} className="reveal card group overflow-hidden">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image src={j.img} alt="" fill sizes="(min-width:1280px) 300px, (min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className="absolute left-4 top-4 rounded-full bg-black/45 px-2.5 py-1 text-[11px] tracking-[0.14em] text-white backdrop-blur-sm">{j.step}</span>
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-[22px] leading-snug">{j.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-stone">{j.body}</p>
                  <p className="mt-5 border-t border-hairline-2 pt-4 text-[13px] text-ink-2 tabular">{j.stat}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Recently booked gallery */}
        {booked.length > 0 && (
          <section className="mt-28 md:mt-36">
            <div className="reveal flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Recently booked</p>
                <h2 className="mt-3 font-serif text-[40px] leading-[1.05] md:text-[56px]">Homes about to change.</h2>
              </div>
              <Link href="/leads?outcome=qualified" className="text-[14px] text-ink-2 hover:text-ink">All booked →</Link>
            </div>
            <div className="no-scrollbar reveal -mx-5 mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:-mx-10 md:px-10">
              {booked.map((l) => (
                <Link key={l.id} href={`/leads/${l.id}`} className="group w-[78vw] shrink-0 snap-start sm:w-[360px]">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[18px]">
                    <Image src={roomImage(l.property_type, l.project_kind, l.id)} alt="" fill sizes="360px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                      <p className="text-[12px] uppercase tracking-[0.16em] text-white/75">{when(l.consultation_at, { weekday: "short" })}</p>
                      <p className="mt-2 font-serif text-[28px] leading-tight">{l.name ?? "New client"}</p>
                      <p className="mt-1 text-[14px] text-white/85">{[l.property_type, l.locality?.split(",")[0]].filter(Boolean).join(" · ")}</p>
                      <p className="mt-3 text-[13px] text-white/70">with {l.designer ?? "a designer"}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Rhythm of the day */}
        <section className="mt-28 grid grid-cols-[minmax(0,1fr)] gap-5 md:mt-36 lg:grid-cols-5">
          <div className="reveal lg:col-span-5">
            <p className="eyebrow">The rhythm</p>
            <h2 className="mt-3 max-w-3xl font-serif text-[40px] leading-[1.05] md:text-[56px]">People call when they&rsquo;re free. Not when we are.</h2>
          </div>
          {day.length > 0 && (
            <div className="reveal card p-7 lg:col-span-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-serif text-[22px]">
                  {new Date(day[0].day).toDateString() === new Date().toDateString() ? "Today" : `Latest day · ${when(day[0].started_at, { hour: undefined, minute: undefined, weekday: "long" })}`}
                </h3>
                <span className="text-[12px] text-stone">{day.length} call{day.length === 1 ? "" : "s"} · tap a dot to open it</span>
              </div>
              <DayStrip calls={day.map((c) => ({ ...c, hour: Number(c.hour) }))} band={band} />
            </div>
          )}
          <div className="reveal card p-7 lg:col-span-5">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-serif text-[22px]">Calls per day</h3>
              <span className="text-[12px] text-stone">Last 30 days · hover a day for detail</span>
            </div>
            <DailyColumns data={ins.daily} />
          </div>
          <div className="reveal card p-7 lg:col-span-3">
            <div className="mb-6 flex items-baseline justify-between">
              <h3 className="font-serif text-[22px]">When people call</h3>
              <span className="text-[12px] text-stone">Hour of day, IST</span>
            </div>
            <HourChart data={hours} band={band} />
          </div>
          <div className="reveal card p-7 lg:col-span-2">
            <div className="mb-6 flex items-baseline justify-between">
              <h3 className="font-serif text-[22px]">Why not a fit</h3>
              <span className="text-[12px] text-stone">{k.declined} declined</span>
            </div>
            <BarList data={reasons.map((r) => ({ label: r.reason, n: r.n }))} empty="No declines in this period." />
          </div>
          <div className="reveal card p-7 lg:col-span-2">
            <div className="mb-6 flex items-baseline justify-between">
              <h3 className="font-serif text-[22px]">Where leads come from</h3>
              <span className="text-[12px] text-stone">From the call</span>
            </div>
            <BarList data={ins.sources} empty="Sources appear once callers say how they heard of Aangan." />
          </div>
          <div className="reveal card p-7 lg:col-span-1">
            <div className="mb-6"><h3 className="font-serif text-[22px]">Top areas</h3></div>
            <BarList data={ins.areas.map((a) => ({ label: a.area, n: a.n }))} empty="No areas yet." />
          </div>
          <div className="reveal card p-7 lg:col-span-2">
            <div className="mb-6 flex items-baseline justify-between">
              <h3 className="font-serif text-[22px]">Designer workload</h3>
              <a href="/designers" className="text-[12px] text-stone hover:text-ink">Upcoming visits · Team →</a>
            </div>
            <BarList
              data={ins.workload.map((w) => ({ label: `${w.name} (${w.done} past)`, n: w.upcoming }))}
              empty="Add designers on the Team page to see their upcoming consultations."
            />
          </div>
        </section>

        {/* People decide */}
        <section className="mt-28 grid grid-cols-[minmax(0,1fr)] gap-5 md:mt-36 lg:grid-cols-2">
          <div className="reveal relative overflow-hidden rounded-[18px] bg-hero p-8 text-hero-ink md:p-10">
            <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">Where people decide</p>
            <h2 className="mt-3 font-serif text-[34px] leading-tight md:text-[42px]">The AI books. People price, judge and care.</h2>
            <ul className="mt-8 space-y-4 text-[15px]">
              <li className="flex items-center justify-between gap-3 border-t border-white/15 pt-4">
                <span>Waiting for the front desk</span>
                <Link href="/review" className="tabular underline-offset-4 hover:underline">{pending} →</Link>
              </li>
              <li className="flex items-center justify-between gap-3 border-t border-white/15 pt-4">
                <span>Asked about price, given the approved line</span>
                <span className="tabular">{k.asked_price}</span>
              </li>
              <li className="flex items-center justify-between gap-3 border-t border-white/15 pt-4">
                <span>Live calls where the AI said a price</span>
                <span className="shrink-0 text-right tabular opacity-80">{priceSlips == null ? "Audited once live" : `${priceSlips} of ${liveCalls}`}</span>
              </li>
            </ul>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
            {money && ranges.length > 0 && (
              <div className="reveal card p-8">
                <div className="flex items-center justify-between gap-3">
                  <p className="eyebrow">Booked pipeline</p>
                  <HumanTag>Internal only</HumanTag>
                </div>
                <p className="mt-4 font-serif text-[44px] leading-none tabular">{crore(pipeLow)}–{crore(pipeHigh)}</p>
                <p className="mt-4 text-[14px] leading-relaxed text-stone">
                  Indicative value of {ranges.length} booked consultation{ranges.length === 1 ? "" : "s"}, from the studio&rsquo;s internal guide. Never shared with callers.
                </p>
              </div>
            )}
            <div className="reveal card p-8">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="eyebrow">Latest enquiries</p>
                <Link href="/leads" className="text-[13px] text-stone hover:text-ink">See all →</Link>
              </div>
              <ul className="divide-y divide-hairline-2">
                {recent.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-terracotta">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px]">{l.name ?? "Unknown caller"}</span>
                        <span className="block truncate text-[13px] text-stone">{[l.property_type, l.locality?.split(",")[0]].filter(Boolean).join(" · ")}</span>
                      </span>
                      <OutcomePill outcome={l.outcome} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
