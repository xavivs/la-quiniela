-- Añadir campo is_historical a jornadas para marcar jornadas históricas (solo puntos, sin resultados)
alter table public.jornadas add column if not exists is_historical boolean default false;

-- Crear índice para búsquedas rápidas
create index if not exists idx_jornadas_is_historical on public.jornadas(is_historical);
