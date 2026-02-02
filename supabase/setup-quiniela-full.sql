-- =============================================================================
-- Setup completo para La Quiniela (una sola ejecución en Supabase SQL Editor)
-- =============================================================================
-- En Supabase: SQL Editor → New query → pega este archivo → Run
-- =============================================================================

-- 1. Extensión UUID
create extension if not exists "uuid-ossp";

-- 2. Tabla users (necesaria para la app)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);
alter table public.users add column if not exists quiniela_name text unique;
alter table public.users add column if not exists role text default 'user';
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('user', 'admin', 'superadmin'));

alter table public.users enable row level security;
drop policy if exists "Users are viewable by everyone" on public.users;
create policy "Users are viewable by everyone" on public.users for select using (true);
drop policy if exists "Users can insert own row" on public.users;
create policy "Users can insert own row" on public.users for insert with check (auth.uid() = id);
drop policy if exists "Users can update own row" on public.users;
create policy "Users can update own row" on public.users for update
  using (auth.uid() = id or (select role from public.users where id = auth.uid()) = 'superadmin')
  with check (
    (auth.uid() = id and role = (select role from public.users where id = auth.uid()))
    or ((select role from public.users where id = auth.uid()) = 'superadmin')
  );

-- Función para RLS: rol del usuario actual
create or replace function public.current_user_role()
returns text as $$ select role from public.users where id = auth.uid(); $$ language sql security definer stable;

-- 3. Tabla jornadas
create table if not exists public.jornadas (
  id uuid primary key default uuid_generate_v4(),
  number int not null unique,
  season text default '2024-25',
  slip_image_url text,
  created_at timestamptz default now()
);

-- 4. Tabla quiniela_matches
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

-- 5. Tabla quiniela_predictions
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

-- 6. RLS jornadas
alter table public.jornadas enable row level security;
drop policy if exists "Jornadas viewable by all" on public.jornadas;
create policy "Jornadas viewable by all" on public.jornadas for select using (true);
drop policy if exists "Jornadas insert by authenticated" on public.jornadas;
create policy "Jornadas insert by admin" on public.jornadas for insert with check (public.current_user_role() in ('admin', 'superadmin'));
drop policy if exists "Jornadas update by authenticated" on public.jornadas;
create policy "Jornadas update by admin" on public.jornadas for update using (public.current_user_role() in ('admin', 'superadmin'));
drop policy if exists "Jornadas delete by authenticated" on public.jornadas;
create policy "Jornadas delete by admin" on public.jornadas for delete using (public.current_user_role() in ('admin', 'superadmin'));

-- 7. RLS quiniela_matches
alter table public.quiniela_matches enable row level security;
drop policy if exists "Quiniela matches viewable by all" on public.quiniela_matches;
create policy "Quiniela matches viewable by all" on public.quiniela_matches for select using (true);
drop policy if exists "Quiniela matches insert by authenticated" on public.quiniela_matches;
create policy "Quiniela matches insert by admin" on public.quiniela_matches for insert with check (public.current_user_role() in ('admin', 'superadmin'));
drop policy if exists "Quiniela matches update by authenticated" on public.quiniela_matches;
create policy "Quiniela matches update by admin" on public.quiniela_matches for update using (public.current_user_role() in ('admin', 'superadmin'));

-- 8. RLS quiniela_predictions
alter table public.quiniela_predictions enable row level security;
drop policy if exists "Quiniela predictions viewable by all" on public.quiniela_predictions;
create policy "Quiniela predictions viewable by all" on public.quiniela_predictions for select using (true);
drop policy if exists "Quiniela predictions insert own" on public.quiniela_predictions;
create policy "Quiniela predictions insert own" on public.quiniela_predictions for insert with check (auth.uid() = user_id);
drop policy if exists "Quiniela predictions update own" on public.quiniela_predictions;
create policy "Quiniela predictions update own" on public.quiniela_predictions for update using (auth.uid() = user_id);

-- 9. Trigger: crear fila en public.users al registrarse (con quiniela_name si viene en metadata)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, quiniela_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'quiniela_name', 'user')
  on conflict (id) do update set
    email = excluded.email,
    quiniela_name = coalesce(public.users.quiniela_name, excluded.quiniela_name);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Listo. Si quieres subir fotos de boletos, crea el bucket en Storage:
-- Storage → New bucket → id: quiniela-slips, público.
-- Luego en Policies del bucket: insert para authenticated, select para all.