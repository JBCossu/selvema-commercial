-- Selvema Commercial — schéma PostgreSQL (Neon)
-- Exécuter une fois : `npm run db:setup` (ou coller dans la console SQL Neon).

-- ── Base de connaissances de l'agence (configuration unique par client) ────────
create table if not exists config (
  id            integer primary key default 1,
  agency_name   text not null default '',
  owner_email   text not null default '',
  owner_phone   text not null default '',
  description   text not null default '',
  faq           text not null default '',
  properties    text not null default '',
  updated_at    timestamptz not null default now(),
  constraint config_singleton check (id = 1)
);

insert into config (id) values (1) on conflict (id) do nothing;

-- ── Conversations du chatbot ─────────────────────────────────────────────────
create table if not exists conversations (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  messages            jsonb not null default '[]'::jsonb,
  origin              text,
  qualified           boolean not null default false,
  callback_requested  boolean not null default false
);

-- ── Fiches prospects qualifiées ──────────────────────────────────────────────
create table if not exists prospects (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  conversation_id    uuid references conversations(id) on delete set null,
  name               text,
  email              text,
  phone              text,
  project_type       text,   -- achat / vente / location
  budget             text,
  property_type      text,
  location           text,
  timeline           text,
  situation          text,
  summary            text,
  kind               text not null default 'qualifie',  -- qualifie | rappel
  status             text not null default 'nouveau',
  -- nouveau | relance_j3_envoyee | relance_j7_envoyee | clos
  followup_3_sent_at timestamptz,
  followup_7_sent_at timestamptz,
  last_followup_at    timestamptz
);

create index if not exists prospects_created_at_idx on prospects (created_at desc);
create index if not exists prospects_status_idx on prospects (status);
