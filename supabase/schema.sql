create extension if not exists pgcrypto;

create table if not exists public.app_state (
  user_id text primary key,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.status_posts (
  id text primary key,
  user_id text not null,
  mood text not null,
  content text not null,
  post_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists status_posts_user_created_idx
  on public.status_posts (user_id, created_at desc);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null,
  content text not null,
  importance integer not null default 1,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists memories_user_created_idx
  on public.memories (user_id, created_at desc);
