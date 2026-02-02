-- Gestión de temporadas: tabla seasons y lógica de archivado

-- Tabla para gestionar temporadas
create table if not exists public.seasons (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  is_active boolean default true,
  created_at timestamptz default now(),
  archived_at timestamptz
);

-- Índices
create index if not exists idx_seasons_is_active on public.seasons(is_active);
create index if not exists idx_jornadas_season on public.jornadas(season);

-- Cambiar constraint único: number debe ser único por temporada, no globalmente
-- Primero eliminar el constraint único existente si existe
alter table public.jornadas drop constraint if exists jornadas_number_key;
alter table public.jornadas drop constraint if exists jornadas_number_unique;

-- Crear constraint único compuesto (season, number)
create unique index if not exists jornadas_season_number_unique on public.jornadas(season, number);

-- RLS
alter table public.seasons enable row level security;

create policy "Seasons viewable by all" on public.seasons 
  for select using (true);

create policy "Seasons insert by admin" on public.seasons 
  for insert with check (public.current_user_role() in ('admin', 'superadmin'));

create policy "Seasons update by admin" on public.seasons 
  for update using (public.current_user_role() in ('admin', 'superadmin'));

-- Si no hay temporadas, crear una por defecto con las jornadas existentes
insert into public.seasons (name, is_active)
select '2024-25', true
where not exists (select 1 from public.seasons);

-- Función para obtener la temporada activa
create or replace function public.get_active_season()
returns text as $$
  select name from public.seasons where is_active = true order by created_at desc limit 1;
$$ language sql stable;

-- Función para archivar temporadas anteriores al crear una nueva
create or replace function public.archive_previous_seasons()
returns void as $$
begin
  update public.seasons
  set is_active = false, archived_at = now()
  where is_active = true;
end;
$$ language plpgsql security definer;
