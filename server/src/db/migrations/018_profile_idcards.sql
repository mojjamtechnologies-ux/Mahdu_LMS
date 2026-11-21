-- Profile pictures + ID card management and scanning.
-- Additive only: nothing is dropped or rewritten, so it is safe on a database that already holds data.

-- 1. Profile picture. The image itself lives in the configured storage driver (Supabase in production);
--    only the storage key and a version stamp (used to refresh the picture everywhere) are kept here.
alter table users add column if not exists avatar_key text;
alter table users add column if not exists avatar_updated_at timestamptz;

-- 2. Human-readable card numbers, e.g. MR-S-000042
create sequence if not exists id_card_number_seq;

-- 3. ID cards. One row per card ever issued, so history is kept for audit.
create table if not exists id_cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  card_number  text not null unique,
  token        text not null,                       -- random, unguessable; the QR code carries this, never personal data
  category     user_role not null,                  -- role at the time of issue
  status       text not null default 'active' check (status in ('active', 'suspended', 'revoked', 'replaced')),
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz,
  revoked_at   timestamptz,
  revoked_by   uuid references users(id) on delete set null,
  revoke_reason text,
  replaced_by  uuid references id_cards(id) on delete set null,
  issued_by    uuid references users(id) on delete set null,
  created_at   timestamptz not null default now()
);
-- "Expired" is not stored: it is an active card whose expires_at has passed, so it can never be out of date.
create unique index if not exists id_cards_token_active_uq on id_cards (token) where status in ('active', 'suspended');
create unique index if not exists id_cards_one_live_per_user on id_cards (user_id) where status in ('active', 'suspended');
create index if not exists id_cards_token_idx on id_cards (token);
create index if not exists id_cards_user_idx on id_cards (user_id, issued_at desc);
create index if not exists id_cards_status_idx on id_cards (status, issued_at desc);

-- 4. Every scan attempt, valid or not (who scanned, what came back).
create table if not exists id_card_scans (
  id         bigserial primary key,
  card_id    uuid references id_cards(id) on delete set null,
  scanned_by uuid references users(id) on delete set null,
  method     text not null check (method in ('qr', 'manual')),
  outcome    text not null,                         -- valid | invalid | unknown | revoked | expired | replaced | suspended | inactive
  ip         text,
  created_at timestamptz not null default now()
);
create index if not exists id_card_scans_created_idx on id_card_scans (created_at desc);
create index if not exists id_card_scans_card_idx on id_card_scans (card_id);

alter table id_cards      enable row level security;
alter table id_card_scans enable row level security;
-- The card template (colours, school details, validity, logo key) is kept in the existing `settings` table under the key 'id_card_template'.
