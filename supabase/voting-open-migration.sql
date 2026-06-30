-- Control de apertura/cierre de votación por jornada
alter table public.jornadas add column if not exists voting_open boolean not null default true;

create index if not exists idx_jornadas_voting_open on public.jornadas(voting_open);
