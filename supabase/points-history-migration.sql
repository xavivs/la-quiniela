-- Historial de puntos por jornada (para jornadas anteriores o puntos manuales)
-- Permite almacenar puntos históricos sin necesidad de tener todas las predicciones

create table if not exists public.quiniela_points_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  jornada_id uuid not null references public.jornadas(id) on delete cascade,
  points int not null default 0 check (points >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, jornada_id)
);

-- RLS
alter table public.quiniela_points_history enable row level security;

create policy "Points history viewable by all" on public.quiniela_points_history 
  for select using (true);

create policy "Points history insert by admin" on public.quiniela_points_history 
  for insert with check (public.current_user_role() in ('admin', 'superadmin'));

create policy "Points history update by admin" on public.quiniela_points_history 
  for update using (public.current_user_role() in ('admin', 'superadmin'));

create policy "Points history delete by admin" on public.quiniela_points_history 
  for delete using (public.current_user_role() in ('admin', 'superadmin'));

-- Trigger para updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_quiniela_points_history_updated_at
  before update on public.quiniela_points_history
  for each row
  execute function update_updated_at_column();
