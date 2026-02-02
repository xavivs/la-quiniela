-- La Quiniela: 14 matches (1/X/2) + match 15 (pleno al 15: 0/1/2/M per team)
-- Run after schema.sql or replace. Adds quiniela_name to users and new tables.

-- Add quiniela_name to users (one of the 8 fixed names)
alter table public.users add column if not exists quiniela_name text unique;

-- Jornada = one week of 15 matches
create table if not exists public.jornadas (
  id uuid primary key default uuid_generate_v4(),
  number int not null unique,
  season text default '2024-25',
  slip_image_url text,
  created_at timestamptz default now()
);

-- 15 matches per jornada. Matches 1-14: result_1x2. Match 15: result_home, result_away (0/1/2/M)
create table if not exists public.quiniela_matches (
  id uuid primary key default uuid_generate_v4(),
  jornada_id uuid not null references public.jornadas(id) on delete cascade,
  match_order int not null check (match_order between 1 and 15),
  home_team text not null,
  away_team text not null,
  result_1x2 text check (result_1x2 is null or result_1x2 in ('1','X','2')),
  result_home text check (result_home is null or result_home in ('0','1','2','M')),
  result_away text check (result_away is null or result_away in ('0','1','2','M')),
  unique(jornada_id, match_order)
);

-- Predictions: 1-14 use predicted_1x2; match 15 uses predicted_home, predicted_away
create table if not exists public.quiniela_predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  quiniela_match_id uuid not null references public.quiniela_matches(id) on delete cascade,
  predicted_1x2 text check (predicted_1x2 is null or predicted_1x2 in ('1','X','2')),
  predicted_home text check (predicted_home is null or predicted_home in ('0','1','2','M')),
  predicted_away text check (predicted_away is null or predicted_away in ('0','1','2','M')),
  created_at timestamptz default now(),
  unique(user_id, quiniela_match_id)
);

-- RLS
alter table public.jornadas enable row level security;
alter table public.quiniela_matches enable row level security;
alter table public.quiniela_predictions enable row level security;

create policy "Jornadas viewable by all" on public.jornadas for select using (true);
create policy "Jornadas insert by authenticated" on public.jornadas for insert with check (auth.role() = 'authenticated');
create policy "Jornadas update by authenticated" on public.jornadas for update using (auth.role() = 'authenticated');
create policy "Jornadas delete by authenticated" on public.jornadas for delete using (auth.role() = 'authenticated');

create policy "Quiniela matches viewable by all" on public.quiniela_matches for select using (true);
create policy "Quiniela matches insert by authenticated" on public.quiniela_matches for insert with check (auth.role() = 'authenticated');
create policy "Quiniela matches update by authenticated" on public.quiniela_matches for update using (auth.role() = 'authenticated');

create policy "Quiniela predictions viewable by all" on public.quiniela_predictions for select using (true);
create policy "Quiniela predictions insert own" on public.quiniela_predictions for insert with check (auth.uid() = user_id);
create policy "Quiniela predictions update own" on public.quiniela_predictions for update using (auth.uid() = user_id);

-- Trigger: set quiniela_name from signup metadata if provided
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, quiniela_name)
  values (new.id, new.email, new.raw_user_meta_data->>'quiniela_name');
  return new;
end;
$$ language plpgsql security definer;

-- Storage bucket for slip images (run in SQL or create in Dashboard: Storage → New bucket)
-- insert into storage.buckets (id, name, public) values ('quiniela-slips', 'quiniela-slips', true) on conflict (id) do nothing;
-- create policy "Allow authenticated uploads" on storage.objects for insert with check (bucket_id = 'quiniela-slips' and auth.role() = 'authenticated');
-- create policy "Public read" on storage.objects for select using (bucket_id = 'quiniela-slips');