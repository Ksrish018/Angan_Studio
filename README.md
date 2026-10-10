# Aangan Concierge

An AI phone concierge for **Aangan Studio**, an interior design studio in Pune. It answers every enquiry call (day or night), checks each caller against the founder's own rules, books a consultation, and hands the designer a ready brief, while people keep the decisions that matter: **price, complaints and every "no".**

**Live app:** https://aangan-concierge.vercel.app

## How it works

```
Caller ─► Vaani voice agent ("Aangan Concierge")
            │  books a slot via Cal.com during the call
            │
            └─ webhooks (call_started · call_ended · call_postprocessing)
                        ▼
              Next.js app on Vercel ─► Gemini reads the transcript
                        │               Nikhil's 5 checks (code, not AI)
                        ├─► Cal.com     find the booked slot
                        ├─► HubSpot     contact + deal for booked clients
                        ├─► Resend      designer brief + calendar invite
                        └─► Neon        leads, timeline, costs
                                 ▼
             Dashboard · Pipeline board · Review queue · Designer view
```

| Outcome | What happens |
|---|---|
| Fits and booked | Designer gets the brief email with an "Add to Google Calendar" button and a `.ics` invite; HubSpot deal created |
| Fits, no slot / no designer free | Front desk review queue |
| One answer missing | Front desk calls back |
| Not a fit | Declined kindly; front desk reviews every decline |
| Existing-client complaint | Escalated; founder alerted; senior lead calls back |
| Silent / hang-up | "Missed · call back" with tap-to-call |
| Asked about price | Approved line only; designer briefed to discuss in person |

## The app

- **Overview:** headline numbers, the **pipeline funnel** (calls → enquiries → fit → booked → held → proposal), how calls ended, calls per day, when people call, why callers weren't a fit, where leads come from, top areas, designer workload, booked pipeline value (internal).
- **Enquiries:** gallery, **pipeline board** (Call back · Booked · Proposal sent · Not going ahead · Existing clients) and list views.
- **Brief:** facts, Nikhil's five checks, a starting material palette, internal planning range, transcript, timeline, reassign / handover.
- **Review:** everything that needs a person.
- **Team:** add, pause or remove designers.
- **Settings:** studio contacts, office hours, cost rates, retention, live connection status, Excel export, Monday digest preview, "Go live" reset.
- **Viewing as:** Founder · Front desk · any designer (no sign-in, by choice).
- Four themes (Studio Linen, Midnight Atelier, Gallery White, Courtyard), installable on phones.

## Repository layout

| Path | What |
|---|---|
| `web/` | The Next.js 16 app (TypeScript, Tailwind v4) |
| `web/src/lib/pipeline.ts` | Call processing: extraction → rules → booking → CRM → email |
| `web/src/lib/rules.ts` | Nikhil's five criteria and the price guard |
| `web/src/knowledge/` | Studio services, internal pricing (server-only), the voice agent's script |
| `web/db/schema.sql` | Database schema |
| `knowledge/vaani-agent.md` | The voice agent's brief as loaded into Vaani |
| `docs/PRD.md` | Product requirements, decisions and go-live checklist |
| `Case 3 - Components Map.html` | The original components map |

## Run it

```bash
cp .env.example .env        # fill in the keys
npm --prefix web install
npm --prefix web run db:migrate
npm --prefix web run dev
```

| Script (in `web/`) | What it does |
|---|---|
| `npm run eval` | Grades the AI against 39 labelled past enquiries (needs `web/data/`, kept private) |
| `npm run agent:build` | Rebuilds the voice agent brief; fails if any price figure appears |
| `npm run db:replay` | Loads the September demo replay (private data) |
| `npx vercel deploy --prod` | Deploys to Vercel |

Secrets live only in `.env` (never committed) and in Vercel's environment variables.
