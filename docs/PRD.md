# PRD — Aangan Concierge

**Product:** Aangan Concierge, an AI phone concierge with a designer handoff and founder dashboard
**Client:** Aangan Studio, Pune (founder: Nikhil Deshpande)
**Owner:** Founder's Office (Srish Kulkarni)
**Status:** v1 draft for build · 9 Oct 2026
**Scope:** Incoming phone calls only. WhatsApp and the web form come later and reuse the same engine.

---

## 1. Summary

Aangan loses good projects because nobody picks up. About half of ~200 enquiries a month get no reply within 48 hours, a third arrive after 7pm, and an enquiry answered within an hour converts 4× better than one answered the next day. When a lead does reach a designer, it arrives as a forwarded message with no context, so the designer asks everything again.

Aangan Concierge answers every call in two rings, at any hour, in English, Hindi or Marathi. It asks the same questions the front desk asks, checks the caller against Nikhil's own rules, and books a consultation on the spot. It then hands the designer a complete, beautiful brief. A human still owns every judgment that matters: **price, complaints from existing clients, and any lead the AI turns away.**

## 2. What Nikhil asked for, and what we build

| Nikhil's ask | Decision | Why |
|---|---|---|
| "Every enquiry answered in five minutes, day or night" | **Build:** answered in under 10 seconds, 24×7 | This is the core pain, worth ₹8–14 lakh per lost project |
| "Good ones reach designers with everything already asked" | **Build:** structured brief, calendar block and email | Kills the repeat-questions problem |
| "Quote our standard per-sq-ft pricing" | **Cut:** pricing stays human | His own `pricing.md` forbids quoting; ranges vary up to 3× by spec; transcripts T02 and T13 show callers book without a number |

**Instead of a quote:** the AI says Nikhil's approved line, books the consultation, and tags the lead "asked about price" so the designer arrives ready to talk numbers.

## 3. Goals and non-goals

**Goals (v1)**
1. 100% of calls answered, 24×7. The median time to answer is under 10 seconds.
2. A qualified caller leaves the call with a booked consultation slot.
3. The designer receives the brief before the consultation, so there are zero repeat questions.
4. Nikhil sees live numbers, including the cost of the tool, without counting anything by hand.
5. Every AI "no" is reviewed by a human within one working day.

**Non-goals (v1)**
- Quoting prices, ranges or "starting from" figures, ever.
- Handling existing-client project issues (they go to a human).
- WhatsApp and web form channels (v2).
- Outbound calling or marketing campaigns.
- Replacing the front desk. It moves from answering phones to reviewing judgment calls.

## 4. Users

| User | Who | What they need | Where they meet the product |
|---|---|---|---|
| **Caller** | Homeowner or office owner in Pune/PCMC, often referred, sometimes calling at 10pm | A warm, competent answer and a clear next step | The phone call and the confirmation |
| **Designer** (14) | Senior and mid-level interior designers | To walk into the consultation already knowing the brief | Calendar invite, handoff email, brief page |
| **Front desk** (2) | Studio coordinators, 10am–7pm | To catch AI mistakes and handle exceptions | Review queue |
| **Nikhil** | Founder | Confidence that no lead is lost, and to know what it costs | Founder dashboard |
| **Senior lead** | Project head on duty | To calm an unhappy existing client fast | Live call transfer and urgent alert |

## 5. Key journeys

### 5.1 Caller: new enquiry (the main path)
1. The caller dials the studio number, which forwards to Concierge. It answers within two rings.
2. **Greeting and consent:** *"Namaste, Aangan Studio. This call is recorded so our designers can prepare for you. How can I help?"*
3. Concierge asks, conversationally and only for what's missing: name, area or locality, property type and size, scope, timeline, who decides, and how they heard of Aangan. It never asks about budget (Nikhil's rule).
4. If the caller asks the price, Concierge gives the approved line from `pricing.md` and offers to book.
5. Concierge checks the five criteria live:
   - **Qualified:** it offers two slots and books one.
   - **Unclear on 1–3:** it asks one direct question.
   - **Fails 2 or more:** it declines gracefully with the approved line.
6. **Close:** it confirms the slot, the designer's name and what to keep ready (floor plan, photos).
7. The caller receives a confirmation (see open question Q4).

### 5.2 Caller: existing client with a complaint (T09)
Concierge detects an existing project ("my designer hasn't replied") and does not try to solve it. It offers a **live transfer** to the senior lead on duty. If nobody answers, it promises a callback within 15 minutes and fires an urgent alert.

### 5.3 Designer: receives a lead
1. A calendar invite lands with the brief inside it (Cal.com).
2. Two minutes later the **handoff email** arrives (Resend). It covers who, where, what, size, timeline, decision-maker, source, flags, and the call summary with a recording link.
3. Before the meeting the designer opens the **brief page**, a single elegant screen built for a phone.
4. After the consultation, the designer marks the outcome (proposal sent / not a fit). This feeds conversion tracking.

### 5.4 Front desk: morning review
At 10am, the review queue lists every declined, unclear or flagged lead since 7pm. For each one they can **approve the decline**, **overturn it** (call back and book), or **add a note**. The target is that the queue is empty by 11am.

### 5.5 Nikhil: the founder view
He opens the dashboard on his phone. It shows yesterday's calls, how fast they were answered, how many were qualified and booked, the decline reasons, and **cost per call and per booked consultation**. He can drill into any lead and its transcript.

## 6. Functional requirements

### 6.1 Voice agent (Vaani)
| ID | Requirement | Priority |
|---|---|---|
| V1 | Answer inbound calls 24×7 on a dedicated number; the studio line forwards to it | P0 |
| V2 | State call recording at the start of every call | P0 |
| V3 | Speak English and Hindi with auto-detect (documented by Vaani). Marathi is **to confirm with Vaani** | P0 |
| V4 | Collect: name, phone (from caller ID; confirm it), locality, property type, carpet area, scope, timeline, decision-maker, source. Configured as Vaani **data-collection points**, so they arrive as `entities` | P0 |
| V5 | **Never** say a number, range, per-sq-ft rate or "around/starting from" for price. Use only the approved deflection line. Enforced in the system prompt and Vaani guardrails | P0 |
| V6 | In-call booking through **Vaani's native Cal.com integration**. Custom HTTP tools mid-call aren't publicly documented; if Vaani confirms them, add `check_service_area` and `get_slots` from our API | P0 |
| V7 | Live transfer to the senior lead's phone for existing-client complaints (Vaani emits `human_transfer_*` events; setup **to confirm with Vaani**) | P0 |
| V8 | If the caller volunteers a clearly-too-low budget (like T10's ₹1–1.5 lakh), say honestly that it's below what that scope costs, with no figure | P1 |
| V9 | Fallback: if the agent or our API is down, forward to the front desk number | P0 |
| V10 | Vaani `call_postprocessing` webhook → our API. It carries the transcript, summary, entities, dispositions and recording. We then fetch caller number, times and cost (credits) from `GET /api/call-history` | P0 |
| V11 | The webhook URL carries a secret token, and the call ID is processed only once (Vaani retries up to 5 times) | P0 |

### 6.2 Qualification engine (our backend)
| ID | Requirement | Priority |
|---|---|---|
| Q1 | Extract structured fields from the transcript with Gemini (JSON schema output) | P0 |
| Q2 | Apply Nikhil's five criteria **in code, not in the model**: service-area list, scope type, minimum lead time (6 weeks, 8–10 ideal), clear budget mismatch, decision-maker | P0 |
| Q3 | Outcomes: `qualified`, `needs_info`, `declined`, `escalation`, `spam/silent` | P0 |
| Q4 | Flags: `asked_price`, `frustrated`, `vip_referral` (names a past client or a friend of Nikhil), `low_confidence` | P0 |
| Q5 | Every decline or `low_confidence` lead enters the review queue | P0 |
| Q6 | Price guardrail on all AI-written text: block any ₹ amount, "lakh/lac/per sq ft" next to a number, and regenerate | P0 |

### 6.3 Booking and handoff
| ID | Requirement | Priority |
|---|---|---|
| B1 | Live slots from Cal.com for the "Consultation" event (60 min; site visit or studio) | P0 |
| B2 | Designer assignment: round-robin across designers with a free slot. VIP referrals go to the principal designer | P1 |
| B3 | Cal.com booking creates the calendar block and invite for the designer | P0 |
| B4 | Handoff email via Resend within 2 minutes of the call ending, CC front desk | P0 |
| B5 | A brief page at `/brief/[id]`, readable on a phone, linked from the email and the invite | P0 |
| B6 | Upsert a HubSpot contact plus a deal ("Consultation booked" stage) with brief fields | P1 |

### 6.4 Review queue (front desk)
| ID | Requirement | Priority |
|---|---|---|
| R1 | List of declined, unclear, flagged and escalated leads, newest first, with an SLA timer | P0 |
| R2 | Actions: approve decline / overturn and book / mark called back / note | P0 |
| R3 | Escalations show at the top in red until marked resolved | P0 |

### 6.5 Founder dashboard
| ID | Requirement | Priority |
|---|---|---|
| D1 | KPIs for today, 7 and 30 days: calls answered, median answer time, after-hours share, qualified %, consultations booked, consultation → proposal % | P0 |
| D2 | Cost: Vaani minutes, Gemini tokens and email costs in ₹; cost per call; cost per booked consultation | P0 |
| D3 | Decline reasons breakdown (out of area, timeline, advice-only, out of scope, budget) | P0 |
| D4 | Calls by hour heatmap (shows the after-hours value) | P1 |
| D5 | Lead list with search, filters and transcript drill-down | P0 |
| D6 | Weekly email digest to Nikhil every Monday at 9am | P2 |

### 6.6 Access
| ID | Requirement | Priority |
|---|---|---|
| A1 | Sign in with Neon Auth. **Allow-list only**: Nikhil, the front desk and the designers. Anyone else is rejected even after sign-up. *Deferred: sign-in is removed while the app is open for testing; it must return before real caller data goes live* | P0 |
| A2 | Roles: `founder` (everything), `front_desk` (queue and leads), `designer` (own briefs) | P0 |
| A3 | Brief links in emails use signed, expiring tokens | P1 |

## 7. Judgment matrix (who decides what)

| Decision | AI | Human | Rule |
|---|---|---|---|
| Ask the qualifying questions | ✅ | | Script from `qualified.md` |
| Price, range, "ballpark" | ❌ never | ✅ designer, at consultation | `pricing.md` |
| Qualified → book | ✅ | Designer can reschedule or reassign | Five criteria pass |
| Unclear lead | Asks 1 question; if still unclear → qualified + note | Designer judges at the consultation | `qualified.md` boundary rules |
| Decline | ✅ says it kindly | ✅ front desk reviews every one | Two or more criteria fail |
| Existing-client complaint | ❌ only transfers | ✅ senior lead within 15 min | Detected intent |
| VIP referral (friend of Nikhil) | Flags it | ✅ principal designer | `vip_referral` flag |

## 8. Guardrails and trust

- **Pricing:** The rule is in the agent prompt, in a post-generation filter, and in a weekly transcript audit that searches for ₹ amounts.
- **Consent and privacy (DPDP Act 2023):** Recording is announced at the start of every call. Personal data stays in Neon (Singapore) and HubSpot. Recordings are kept for 90 days, then deleted. Any caller can ask for deletion.
- **No hallucinated promises:** The AI cannot promise dates, discounts or specific designers it hasn't booked. Slot times come only from Cal.com.
- **Graceful failure:** Every step after the call is retried. If an email or booking fails, the lead goes to the review queue, so nothing is silently lost.

## 9. Data model (Neon Postgres)

- `designers` (name, email, phone, Cal.com username, is_principal, active)
- `calls` (Vaani call id, from number, started/ended, duration, after-hours flag, transcript, recording URL, language, cost in ₹)
- `leads` (call_id, name, phone, locality, in_service_area, property type, carpet sq ft, scope, timeline, decision-maker, source, budget_volunteered, outcome, decline_reason, criteria JSON, flags[], summary, designer_id, consultation_at, Cal.com booking id, HubSpot ids, review_status, consultation outcome)
- `review_actions` (lead, actor, action, note, time)
- `cost_events` (call, vendor, units, ₹)
- `app_users` (email, role) — the allow-list

## 10. Architecture

```
Caller ──► Studio number ──(forward)──► Vaani voice agent
                                         │  in-call booking (Vaani ↔ Cal.com)
                                         │
             call_postprocessing webhook ──►  Next.js on Vercel  /api/webhooks/vaani
                                         │      (+ GET call-history for number, times, cost)
                                         │
          ┌──────────────┬───────────────┼───────────────┬──────────────┐
          ▼              ▼               ▼               ▼              ▼
     Gemini extract   Rules engine    Cal.com book    Resend email   HubSpot sync
          └──────────────┴──────► Neon Postgres ◄──────┴──────────────┘
                                         │
                       Dashboard · Review queue · Brief page (Neon Auth)
```

**Stack:** Next.js (App Router, TypeScript) · Tailwind · Neon serverless Postgres · Gemini (Flash-tier, JSON mode) · Cal.com API v2 · Resend · HubSpot CRM v3 · Vercel.

## 11. Experience and design language

Aangan sells calm, warm, considered spaces. The product should feel like walking into their studio, not like a call centre.

**Principles**
1. **Quiet confidence.** Lots of space, few colours, and one accent. Numbers big and calm, never flashing.
2. **Brief-first.** The most important screen is the designer's brief. It reads like a well-made project card, not a CRM record.
3. **Phone-first for people on the move.** Designers and Nikhil open things on their phones between site visits.
4. **Human moments are visible.** Every place a person decides is marked with a soft terracotta tag, so the AI's limits are always obvious.

**Visual system**
| Token | Value | Use |
|---|---|---|
| Linen (background) | `#F6F2EC` | Page |
| Paper (surface) | `#FFFDF9` | Cards |
| Ink | `#1F1B16` | Text |
| Stone | `#7A7064` | Secondary text |
| Terracotta (accent) | `#B5552E` | Human-judgment markers, primary actions |
| Sage | `#5F7A61` | Qualified / booked |
| Ochre | `#B88A2E` | Needs review |
| Dark mode | Walnut `#16130F` background, warm off-white text | |

- **Type:** *Fraunces* (serif) for headings and big numbers; *Inter* for UI text; tabular figures for metrics.
- **Shape:** 14px card radius, hairline warm borders, no heavy shadows, generous 24–32px padding.
- **Motion:** 150–200ms fades only.

**Screens (v1)**
1. **Overview** (founder): a greeting line, four KPI tiles (answered, booked, qualified %, cost per booking), a calls-by-hour strip, decline reasons and a recent leads list.
2. **Leads:** a calm table with outcome pills; a filter bar for outcome, flags and designer.
3. **Lead / Brief:** a header with the name and locality, then a "the brief" card (size · scope · timeline · decision-maker), flags, a call summary, a transcript drawer and a timeline of events. The same page is shared with the designer.
4. **Review queue:** cards with an SLA timer and three clear actions.
5. **Designers:** roster, load this week, and Cal.com connection status.

**The handoff email:** a plain, typographic email with the Aangan wordmark, a one-line headline ("Priya · 3BHK · Kothrud · Thu 10 Oct, 11:00"), a fact grid, flags, the summary, and one button: "Open brief". It ends with a quiet line: *Pricing is yours to discuss — no figures were shared.*

## 12. Success metrics

| Metric | Baseline (Sep 2026) | v1 target (8 weeks) |
|---|---|---|
| Calls answered | ~52% within 48 h | 100% |
| Median time to answer | hours to days | < 10 s |
| Qualified callers booked on the call | ~0% (callback needed) | ≥ 70% |
| Designer repeat questions | most first calls | ~0 (designer survey) |
| Wrongly declined leads (overturned in review) | n/a | < 5% of declines |
| Price figures spoken by AI | n/a | **0** |
| Cost per booked consultation | n/a | tracked; expected < ₹300 |

## 13. Cost model (to be confirmed with vendor rates)

~200 calls × ~5 min ≈ 1,000 voice minutes a month. Assuming roughly ₹8–12 a minute for voice, plus a small amount of Gemini and email, that's about **₹10–15k a month**. One extra project (₹8–14 lakh) pays for years. The dashboard shows actual figures from each call's cost data, not estimates.

## 14. Rollout

| Phase | What | Exit criteria |
|---|---|---|
| 0. Foundations (this week) | Repo, data model, dashboard and brief UI on real September transcripts, integrations wired | Nikhil can click through his own September enquiries |
| 1. Shadow mode (week 2) | Concierge answers **after-hours only**; front desk reviews 100% | 50 calls, 0 price quotes, < 5% overturned |
| 2. Live (week 3–4) | 24×7; designers get handoffs; HubSpot sync | Booking rate ≥ 60% of qualified |
| 3. Expand (v2) | WhatsApp and web form through the same engine; Monday digest | — |

## 15. Risks

| Risk | Mitigation |
|---|---|
| AI says a price | Prompt rule + output filter + transcript audit; shadow mode first |
| Wrong decline loses a big project | Every decline reviewed next morning; VIP referrals never auto-declined |
| Callers dislike talking to AI | Warm voice, local languages, transfer to a human on request |
| Calendar data is stale, causing double-booking | Book only through Cal.com; designers keep calendars connected |
| Vendor outage | Forward to the front desk; every post-call step is retried |

## 16. Open questions

| # | Question | Owner | Default if no answer |
|---|---|---|---|
| Q1 | Which domain do emails come from (e.g. `concierge@aanganstudio.in`)? DNS access is needed | Nikhil | Test sender (owner inbox only) |
| Q2 | Studio number forwarding: always, or after-hours first? | Nikhil | After-hours first (phase 1) |
| Q3 | Designer roster, emails, and Cal.com Teams plan for round-robin | Nikhil / Ops | Single Cal.com account, manual assign |
| Q4 | Caller confirmation: SMS (needs DLT), Cal.com email, or the call only | Nikhil | Confirmed on the call + Cal.com email if given |
| Q5 | Senior lead on-duty phone number for transfers | Nikhil | Front desk number |
| Q6 | Vercel Pro for commercial use (~$20/month) | Nikhil | Hobby during the pilot |
| Q7 | Vaani credit top-up (₹100 now) | Nikhil | Enough for testing only |
| Q8 | Vaani to confirm: Indian inbound numbers, warm-transfer setup, Marathi, webhook signing, INR per credit, custom in-call HTTP tools | Founder's Office | Proceed with the documented features only |

*Vaani facts are from the public docs at docs.vaanivoice.ai (base URL `https://api.vaanivoice.ai`, header `X-API-Key`).*

## 17. Knowledge and evaluation ("training")

Concierge isn't fine-tuned. It's grounded in the studio's own documents and graded against real enquiries.

| Source | How it's used | Where |
|---|---|---|
| `services.md` | What the voice agent can say; service-area and scope checks; FAQ answers | `web/src/knowledge/services.ts` |
| `qualified.md` | The five criteria and boundary rules, applied in code | `web/src/lib/rules.ts` |
| `pricing.md` | **Internal only, server-side.** (1) Spots a clearly-too-low volunteered budget. (2) Shows founder and designers an indicative planning range and pipeline value, marked "Internal only". It never goes to the voice agent, callers or emails | `web/src/knowledge/pricing.ts` (`server-only`) |
| September enquiries (40) | 19 phone calls replayed into the dashboard. 39 enquiries (phone, WhatsApp, web form) form a graded exam with answers labelled from `qualified.md` | `web/data/`, `npm run eval` |

**Voice agent brief:** generated from the same sources by `npm run agent:build` into `knowledge/vaani-agent.md` and `.json`. The build fails if any pricing figure appears in it.

**Current score:** 39/39 correct outcomes on two consecutive runs, with 0 price figures in AI-written text. The answers were labelled by the Founder's Office from `qualified.md`, so Nikhil or the front desk should spot-check them. Re-run the exam after any prompt or rule change.

**Testing policy:** Vaani credit is limited, so the exam uses Gemini only, with no live Vaani calls.

## 18. Deployment and go-live (10 Oct 2026)

**Live:** https://aangan-concierge.vercel.app (Vercel project `aangan-concierge`, Singapore region, daily cron at 09:00 IST). Open access by the founder's decision (no sign-in); a "Viewing as" switch shows the founder, front desk or designer view.

**Verified on production without Vaani** (`scripts/e2e.ts`, Vaani-shaped webhooks in test mode): booked call → Gemini → rules → Cal.com lookup → HubSpot contact + deal → designer brief email delivered; silent call → Missed; Lonavala → declined; existing-client complaint → escalated; duplicate delivery ignored; bad token rejected. Test records were removed afterwards.

**Already configured:** Vaani agent "Aangan Concierge" (script, FAQ, strict guardrails, data points, call outcomes) · Cal.com "Aangan consultation" 60-min event type · HubSpot stage chosen automatically from the account's pipeline.

**Left for the studio (cannot be done from code):**
1. Vaani: buy/assign an Indian number to the agent, connect Cal.com inside Vaani's integrations, set the transfer number, and add the webhook URL `https://aangan-concierge.vercel.app/api/webhooks/vaani?token=<VAANI_WEBHOOK_TOKEN>`.
2. Resend: verify Aangan's domain; until then set "Send all briefs to" in Settings to the Resend owner's inbox.
3. Settings: founder email, front desk email, senior lead phone.
4. Team: add the real designers, then Settings → Go live → Clear demo data.
5. Rotate the API keys shared during setup; consider sign-in before real caller data accumulates.

## 19. Release 10 Oct 2026: calendar invites and pipeline

- **Designer calendar invite:** every brief email now carries a standard `.ics` invite (Google, Outlook, Apple; 1-hour reminder) and an "Add to Google Calendar" button. Verified by sending one brief to the Resend owner inbox.
- **Pipeline funnel on the overview:** Calls answered → Real enquiries → Good fit → Consultation booked → Consultation held → Proposal sent, with step-to-step conversion.
- **New charts:** how calls ended (outcome mix), calls per day (booked highlighted), where leads come from (referral, Instagram, Google…), top areas, designer workload.
- **Pipeline board** in Enquiries: Call back · Consultation booked · Proposal sent · Not going ahead · Existing clients.
- **Safety:** booked calls with no available designer are flagged "No designer available" for the front desk; the webhook reads Vaani's transcript under any field name and fetches it from Vaani if missing.
- **Vaani:** webhook registered (3 events + all call details); Cal.com connected with check-availability, book and reschedule tools on the "Aangan consultation" event type; cancel deliberately off.

**Still to do (studio):** a phone number for the agent (set to inbound) and call forwarding from the studio line; add designers on the Team page; founder / front desk / senior contacts in Settings; verify Aangan's email domain in Resend; Cal.com Teams if bookings should follow each designer's own availability.
