-- OAS Pin Library — Supabase schema
-- Run in Supabase SQL editor, then seed with: npm run seed

create extension if not exists "pgcrypto";

-- Profiles (mirrors auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.pins (
  id text primary key,
  name text not null default 'Untitled Pin',
  subtype text not null default 'Video',
  branch text not null default 'Ads',
  "column" text not null default 'videos',
  price text not null default '₹0',
  lower text not null default '₹0',
  higher text not null default '₹0',
  "PM" boolean not null default false,
  status text not null default 'Draft',
  tags text[] not null default '{}',
  display_tags text[] not null default '{}',
  notes text not null default '',
  expected_client text[] not null default '{}',
  selling text[] not null default '{}',
  creative_pack text[] not null default '{}',
  full_campaign text[] not null default '{}',
  talent text[] not null default '{}',
  problems text[] not null default '{}',
  hooks integer not null default 0,
  angles integer not null default 0,
  executions integer not null default 0,
  assets integer not null default 0,
  format_assets jsonb not null default '{}'::jsonb,
  format_packs jsonb not null default '{}'::jsonb,
  stage integer not null default 1,
  footer_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fix legacy unquoted PM → "PM" (Postgres lowercased it to pm)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pins' and column_name = 'pm'
  ) then
    alter table public.pins rename column pm to "PM";
  end if;
end $$;

create table if not exists public.problems (
  id text primary key,
  title text not null,
  label text not null,
  letter text not null default '',
  expected_client text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.catalogs (
  key text primary key,
  options text[] not null default '{}'
);

create index if not exists pins_column_idx on public.pins ("column");
create index if not exists pins_status_idx on public.pins (status);
create index if not exists pins_branch_idx on public.pins (branch);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists pins_updated_at on public.pins;
create trigger pins_updated_at
  before update on public.pins
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: authenticated users can read/write (internal tool)
alter table public.pins enable row level security;
alter table public.problems enable row level security;
alter table public.catalogs enable row level security;
alter table public.profiles enable row level security;

create policy "Authenticated read pins" on public.pins
  for select to authenticated using (true);
create policy "Authenticated write pins" on public.pins
  for all to authenticated using (true) with check (true);

create policy "Authenticated read problems" on public.problems
  for select to authenticated using (true);
create policy "Authenticated write problems" on public.problems
  for all to authenticated using (true) with check (true);

create policy "Authenticated read catalogs" on public.catalogs
  for select to authenticated using (true);
create policy "Authenticated write catalogs" on public.catalogs
  for all to authenticated using (true) with check (true);

create policy "Users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);
