-- Aangan Concierge schema (Neon Postgres). Safe to re-run.

create table if not exists designers (
  id              serial primary key,
  name            text not null,
  email           text not null unique,
  phone           text,
  calcom_username text,
  is_principal    boolean not null default false,
  active          boolean not null default true,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists calls (
  id               serial primary key,
  vaani_call_id    text unique,
  source           text not null default 'vaani',      -- vaani | replay
  from_number      text,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  duration_sec     integer,
  answer_sec       numeric,                             -- seconds until the agent picked up
  after_hours      boolean not null default false,      -- outside 10am-7pm IST
  language         text,
  transcript       text,
  summary          text,
  recording_url    text,
  end_reason       text,
  raw              jsonb,
  created_at       timestamptz not null default now()
);

create table if not exists leads (
  id                    serial primary key,
  call_id               integer not null unique references calls(id) on delete cascade,
  name                  text,
  phone                 text,
  locality              text,
  in_service_area       boolean,
  property_type         text,
  carpet_sqft           integer,
  scope                 text,
  project_kind          text,          -- residential_full | residential_partial | single_room | commercial_office | advice_only | out_of_scope | unknown
  timeline              text,
  weeks_to_deadline     integer,
  decision_maker        text,
  source                text,
  budget_volunteered    text,
  is_existing_client    boolean not null default false,
  outcome               text not null, -- qualified | needs_info | declined | escalation
  decline_reason        text,
  criteria              jsonb not null,
  flags                 text[] not null default '{}',
  summary               text,
  designer_notes        text,
  designer_id           integer references designers(id),
  consultation_at       timestamptz,
  consultation_mode     text,          -- site_visit | studio
  calcom_booking_uid    text,
  hubspot_contact_id    text,
  hubspot_deal_id       text,
  handoff_emailed_at    timestamptz,
  review_status         text not null default 'none', -- none | pending | approved | overturned | resolved
  consultation_outcome  text,          -- proposal_sent | not_a_fit | no_show
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists leads_outcome_idx on leads (outcome);
create index if not exists leads_review_idx on leads (review_status);

create table if not exists lead_events (
  id       serial primary key,
  lead_id  integer not null references leads(id) on delete cascade,
  actor    text not null,              -- concierge | system | email of a person
  kind     text not null,
  note     text,
  at       timestamptz not null default now()
);

create table if not exists cost_events (
  id         serial primary key,
  call_id    integer not null references calls(id) on delete cascade,
  vendor     text not null,            -- vaani | gemini | resend
  units      numeric,
  unit       text,
  inr        numeric not null,
  estimated  boolean not null default false,
  at         timestamptz not null default now()
);

create table if not exists app_users (
  email  text primary key,
  name   text,
  role   text not null                 -- founder | front_desk | designer
);

-- Calls in progress, from Vaani's call_started / call_ended events (drives the "on a call now" indicator).
create table if not exists live_calls (
  vaani_call_id  text primary key,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz
);

-- Team management: what each designer does and whether they take new consultations.
alter table designers add column if not exists specialty text;
alter table designers add column if not exists paused boolean not null default false;

-- Studio settings Nikhil can change from the dashboard (key -> JSON value).
create table if not exists settings (
  key    text primary key,
  value  jsonb not null,
  updated_at timestamptz not null default now()
);

-- Every call to an outside service, so the Connections page can say "last worked at…".
create table if not exists integration_log (
  id       serial primary key,
  service  text not null,          -- vaani | gemini | calcom | hubspot | resend | cron
  ok       boolean not null,
  detail   text,
  at       timestamptz not null default now()
);
create index if not exists integration_log_service_idx on integration_log (service, at desc);
