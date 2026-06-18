-- =====================================================================
-- Mshmaroti v2.0 — Supabase schema
-- Run this once in Supabase SQL Editor when setting up a new project.
-- =====================================================================

-- ---------- shifts table ----------
create table public.shifts (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  job_type    text not null check (job_type in ('wedding', 'hourly')),
  hours       numeric(5,2) not null check (hours >= 0),
  break_minutes integer not null default 0 check (break_minutes >= 0), -- unpaid break (hourly job)
  start_time  text,   -- "HH:MM" or null
  end_time    text,   -- "HH:MM" or null
  base        numeric(10,2) not null check (base >= 0),
  tips        numeric(10,2) not null default 0 check (tips >= 0),
  expenses    numeric(10,2) not null default 0 check (expenses >= 0),
  total       numeric(10,2) not null check (total >= 0),
  notes       text,
  created_at  timestamptz not null default now()
);

-- Index for fast date-range queries (which we do constantly)
create index shifts_user_date_idx on public.shifts (user_id, date desc);
create index shifts_user_job_idx  on public.shifts (user_id, job_type);

-- Enable Row Level Security so users only see their own shifts
alter table public.shifts enable row level security;

create policy "Users can view own shifts"
  on public.shifts for select
  using (auth.uid() = user_id);

create policy "Users can insert own shifts"
  on public.shifts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own shifts"
  on public.shifts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own shifts"
  on public.shifts for delete
  using (auth.uid() = user_id);


-- ---------- user_settings table (one row per user) ----------
create table public.user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  wedding_rate   numeric(10,2) not null default 200,
  hourly_rate    numeric(10,2) not null default 35,
  wedding_name   text not null default 'אולם אירועים',
  hourly_name    text not null default 'שעתי',
  updated_at     timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can upsert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------- auto-create default settings on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
