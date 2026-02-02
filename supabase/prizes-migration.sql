-- Tabla para gestionar premios de la quiniela
create table if not exists public.quiniela_prizes (
  id uuid primary key default uuid_generate_v4(),
  jornada_id uuid not null references public.jornadas(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount decimal(10, 2) not null check (amount >= 0),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(jornada_id, user_id)
);

-- Índices
create index if not exists idx_prizes_jornada on public.quiniela_prizes(jornada_id);
create index if not exists idx_prizes_user on public.quiniela_prizes(user_id);

-- RLS
alter table public.quiniela_prizes enable row level security;

create policy "Prizes viewable by all" on public.quiniela_prizes 
  for select using (true);

create policy "Prizes insert by admin" on public.quiniela_prizes 
  for insert with check (public.current_user_role() in ('admin', 'superadmin'));

create policy "Prizes update by admin" on public.quiniela_prizes 
  for update using (public.current_user_role() in ('admin', 'superadmin'));

create policy "Prizes delete by admin" on public.quiniela_prizes 
  for delete using (public.current_user_role() in ('admin', 'superadmin'));

-- Trigger para updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_quiniela_prizes_updated_at
  before update on public.quiniela_prizes
  for each row
  execute function update_updated_at_column();
