-- Football Predictions: Database schema for Supabase
-- Run this in Supabase SQL Editor after creating your project

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Matches table (admin creates these)
create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  home_team text not null,
  away_team text not null,
  date timestamptz not null,
  real_home_score integer,
  real_away_score integer,
  created_at timestamptz default now()
);

-- Users table (synced from auth.users; you can also use auth.users directly)
-- This table stores display info; auth is handled by Supabase Auth
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);

-- Predictions: one per user per match
create table if not exists public.predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  predicted_home_score integer not null,
  predicted_away_score integer not null,
  created_at timestamptz default now(),
  unique(user_id, match_id)
);

-- RLS policies
alter table public.matches enable row level security;
alter table public.users enable row level security;
alter table public.predictions enable row level security;

-- Matches: everyone can read
create policy "Matches are viewable by everyone"
  on public.matches for select using (true);

-- Matches: only authenticated users with admin role can insert/update
-- For simplicity we allow any authenticated user to insert; restrict via app or add auth.jwt()->>'role' = 'admin'
create policy "Authenticated users can insert matches"
  on public.matches for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update matches"
  on public.matches for update using (auth.role() = 'authenticated');

-- Users: users can read all (for leaderboard), insert/update own
create policy "Users are viewable by everyone"
  on public.users for select using (true);
create policy "Users can insert own row"
  on public.users for insert with check (auth.uid() = id);
create policy "Users can update own row"
  on public.users for update using (auth.uid() = id);

-- Predictions: users can read all, insert/update/delete own
create policy "Predictions are viewable by everyone"
  on public.predictions for select using (true);
create policy "Users can insert own predictions"
  on public.predictions for insert with check (auth.uid() = user_id);
create policy "Users can update own predictions"
  on public.predictions for update using (auth.uid() = user_id);
create policy "Users can delete own predictions"
  on public.predictions for delete using (auth.uid() = user_id);

-- Trigger: create public.users row on signup (optional but recommended)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
