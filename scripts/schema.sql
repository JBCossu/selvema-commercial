-- Selvema Commercial — schéma PostgreSQL (Neon) — architecture multi-clients.
-- Exécuter une fois : `npm run db:setup` (ou coller dans la console SQL Neon).
-- Ré-exécutable sans risque (create ... if not exists / add column if not exists).

-- ── Clients (une agence immobilière = un client) ─────────────────────────────
-- La config du chatbot est en DEUX prompts :
--   • PROMPT SYSTÈME  : fixe, dans le code (lib/knowledge.ts → SYSTEM_PROMPT)
--   • BASE DE CONNAISSANCES : colonne clients.chatbot_config, propre au client,
--     générée par l'analyse du site.
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  agency_name   text not null,
  owner_email   text not null,
  owner_phone   text not null default '',
  active        boolean not null default true
);

-- Colonnes ajoutées après la v1 du schéma.
alter table clients add column if not exists site_url        text not null default '';
alter table clients add column if not exists chatbot_config  text not null default '';
alter table clients add column if not exists tagline         text not null default 'Une question ? Je suis là pour vous aider.';

-- ── Couleurs du widget (5 champs configurables par client) ───────────────────
alter table clients add column if not exists widget_color     text not null default '#882de1'; -- contours : tous les bords/bordures du widget
alter table clients add column if not exists background_color text not null default '#0a0a1a'; -- fond de la zone de conversation (80 %)
alter table clients add column if not exists bubble_color     text not null default '#882de1'; -- fond des bulles de l'assistant (texte blanc)
alter table clients add column if not exists tagline_color    text not null default '#ffffff'; -- texte de la phrase d'accroche (zone 20 %)
alter table clients add column if not exists top_bg_color     text not null default '#000000'; -- fond de la zone haute personnage (20 %)
-- character_color : ajoutée puis abandonnée. Colonne conservée si elle existe, plus utilisée.

-- Colonnes de la v1 devenues inutilisées (la "section Compléments" a été retirée
-- du formulaire). Conservées si elles existent déjà — sans effet sur le code.
-- Pour repartir de zéro, décommenter :
--   alter table clients drop column if exists description;
--   alter table clients drop column if exists zones;
--   alter table clients drop column if exists properties;
--   alter table clients drop column if exists faq;

-- ── Conversations du chatbot (rattachées à un client) ───────────────────────
create table if not exists conversations (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references clients(id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  messages           jsonb not null default '[]'::jsonb,
  qualified          boolean not null default false,
  callback_requested boolean not null default false
);

-- ── Leads / fiches prospects (rattachés à un client) ────────────────────────
create table if not exists leads (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references clients(id) on delete cascade,
  conversation_id    uuid references conversations(id) on delete set null,
  created_at         timestamptz not null default now(),
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

-- relance_response / relance_response_at : ajoutées puis abandonnées (les
-- boutons de relance sont devenus des réponses préécrites mailto vers le
-- dirigeant, sans page web ni suivi en base). Colonnes laissées si elles
-- existent, plus lues.

create index if not exists leads_client_created_idx on leads (client_id, created_at desc);
create index if not exists leads_status_idx on leads (status);
create index if not exists conversations_client_idx on conversations (client_id);
