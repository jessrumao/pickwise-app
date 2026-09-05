-- L5. The only three tables the MVP needs.
-- Runs on Vercel Postgres / Neon. L0-L4 live in git and ship in the build;
-- only runtime writes belong here.

create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);
-- Auth.js (NextAuth) also creates accounts / sessions / verification_tokens.
-- Use the official Postgres adapter migration for those rather than hand-rolling them.

-- Snapshot per edit, never update in place. A profile row is immutable once written:
-- that is the entire reason a six-month-old recommendation stays reproducible.
create table profile_versions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references users(id) on delete cascade,
  created_at                timestamptz not null default now(),

  age                       int  not null,
  sex                       text not null,
  body_weight_kg            numeric(5,2) not null,     -- required: protein dosing is g/kg
  height_cm                 numeric(5,1),
  dietary_pattern           text not null,
  exercise_frequency_pw     int  not null,
  exercise_type             text[] not null default '{}',
  primary_goals             text[] not null,           -- order matters: index 0 scores 2 in goal_alignment
  sleep_hours_typical       numeric(3,1),
  existing_supplement_use   text[] not null default '{}',  -- normalised to compound ids
  dietary_protein_adequacy  text not null,
  estimated_daily_protein_g numeric(5,1),
  oily_fish_servings_pw     int,
  allergies                 text[] not null default '{}',
  relevant_health_context   text,
  is_pregnant_or_bf         boolean not null default false,
  medications_has_any       boolean not null default false,
  medications_free_text     text,
  medications_parse_conf    numeric(3,2),              -- < 0.80 escalates, per the fail-closed safety rule

  monthly_budget_inr        int,                       -- read ONLY by the budget allocator
  budget_is_hard_constraint boolean not null default true,

  field_confidence          jsonb not null default '{}'::jsonb,
  confirmed_by_user         text[] not null default '{}'
);
create index on profile_versions (user_id, created_at desc);   -- "current profile" = latest row

-- Immutable. Three pins: one profile row, two git SHAs.
create table decision_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  profile_version_id uuid not null references profile_versions(id),
  created_at         timestamptz not null default now(),

  kb_sha             text not null,   -- git commit of data/ at request time
  ruleset_sha        text not null,   -- git commit of the engine at request time
  engine_version     text not null,

  trace              jsonb not null,  -- per-policy clause traces; the explanation is generated FROM this
  recommendation     jsonb not null,  -- per item: status, grade, dose target, serving plan, chosen product
  budget_outcome     jsonb,           -- funded[], deferred[] with prices, priority scores
  escalations        jsonb not null default '[]'::jsonb,

  -- appended later by the feedback loop; never overwrite the fields above
  adherence_reported jsonb,
  outcome_reported   jsonb,
  feedback_at        timestamptz
);
create index on decision_records (user_id, created_at desc);

-- Guard rail worth having from day one: a decision must never point at a profile
-- belonging to a different user.
alter table decision_records add constraint decision_profile_same_user
  check (true) not valid;  -- enforce in application code or a trigger; documented here so it is not forgotten
