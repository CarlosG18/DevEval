-- ============================================================
-- DevEval — Schema Supabase (versão 2)
-- ============================================================
-- Se estiver criando do ZERO, execute o bloco "CRIAÇÃO COMPLETA".
-- Se já tem as tabelas da v1, execute apenas o bloco "MIGRAÇÃO".
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO v1 → v2 (execute se as tabelas já existem)
-- ════════════════════════════════════════════════════════════

-- Squads: links dos repositórios
alter table squads
  add column if not exists repo_frontend text,
  add column if not exists repo_backend  text;

-- Developers: papel no projeto (PO, Scrum Master ou nenhum)
alter table developers
  add column if not exists role text
    check (role in ('po', 'scrum_master'))
    default null;

-- Voters: categoria de votação
alter table voters
  add column if not exists voter_type text not null
    check (voter_type in ('frontend', 'backend', 'both'))
    default 'both';


-- ════════════════════════════════════════════════════════════
-- CRIAÇÃO COMPLETA (use apenas em banco novo / zerado)
-- ════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists squads (
  id            text primary key,
  name          text not null unique,
  repo_frontend text,
  repo_backend  text,
  created_at    bigint not null default extract(epoch from now()) * 1000
);

create table if not exists developers (
  id          text primary key,
  name        text not null,
  squad_id    text not null references squads(id) on delete cascade,
  type        text not null check (type in ('frontend', 'backend')),
  role        text check (role in ('po', 'scrum_master')) default null,
  created_at  bigint not null default extract(epoch from now()) * 1000,
  unique (name, squad_id)
);

create table if not exists voters (
  id          text primary key,
  name        text not null unique,
  voter_type  text not null check (voter_type in ('frontend', 'backend', 'both')) default 'both',
  created_at  bigint not null default extract(epoch from now()) * 1000
);

create table if not exists evaluations (
  id             text primary key,
  developer_id   text not null references developers(id) on delete cascade,
  voter_id       text not null references voters(id) on delete restrict,
  scores         jsonb not null,
  average        numeric(4,2) not null,
  created_at     bigint not null default extract(epoch from now()) * 1000,
  unique (developer_id, voter_id)
);

alter table squads      enable row level security;
alter table developers  enable row level security;
alter table voters      enable row level security;
alter table evaluations enable row level security;

create policy "Acesso publico squads"      on squads      for all using (true) with check (true);
create policy "Acesso publico developers"  on developers  for all using (true) with check (true);
create policy "Acesso publico voters"      on voters      for all using (true) with check (true);
create policy "Acesso publico evaluations" on evaluations for all using (true) with check (true);
