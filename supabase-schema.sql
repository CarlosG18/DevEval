-- ============================================================
-- DevEval — Schema Supabase
-- Execute este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard → SQL Editor → New query
-- ============================================================

-- Habilita a extensão para geração de UUIDs (já vem ativa por padrão)
create extension if not exists "pgcrypto";

-- ── Squads ────────────────────────────────────────────────────────────
create table if not exists squads (
  id          text primary key,
  name        text not null unique,
  created_at  bigint not null default extract(epoch from now()) * 1000
);

-- ── Desenvolvedores ───────────────────────────────────────────────────
create table if not exists developers (
  id          text primary key,
  name        text not null,
  squad_id    text not null references squads(id) on delete cascade,
  type        text not null check (type in ('frontend', 'backend')),
  created_at  bigint not null default extract(epoch from now()) * 1000,
  unique (name, squad_id)   -- mesmo dev não pode aparecer duas vezes no mesmo squad
);

-- ── Votantes ──────────────────────────────────────────────────────────
create table if not exists voters (
  id          text primary key,
  name        text not null unique,
  created_at  bigint not null default extract(epoch from now()) * 1000
);

-- ── Avaliações ────────────────────────────────────────────────────────
create table if not exists evaluations (
  id             text primary key,
  developer_id   text not null references developers(id) on delete cascade,
  voter_id       text not null references voters(id) on delete restrict,
  scores         jsonb not null,           -- { criterion_key: score, ... }
  average        numeric(4,2) not null,
  created_at     bigint not null default extract(epoch from now()) * 1000,
  unique (developer_id, voter_id)          -- um votante só avalia cada dev uma vez
);

-- ── Row Level Security (RLS) ──────────────────────────────────────────
-- Por padrão, o Supabase bloqueia acesso público.
-- As políticas abaixo liberam leitura e escrita para a chave anon
-- (adequado para uso interno/intranet). Ajuste conforme sua necessidade.

alter table squads      enable row level security;
alter table developers  enable row level security;
alter table voters      enable row level security;
alter table evaluations enable row level security;

-- Política: qualquer usuário anônimo pode ler e escrever
-- (substitua por políticas mais restritivas em produção)
create policy "Acesso público – squads"
  on squads for all using (true) with check (true);

create policy "Acesso público – developers"
  on developers for all using (true) with check (true);

create policy "Acesso público – voters"
  on voters for all using (true) with check (true);

create policy "Acesso público – evaluations"
  on evaluations for all using (true) with check (true);

-- ============================================================
-- ✅ Pronto! Volte ao app e configure o js/config.js
-- ============================================================
