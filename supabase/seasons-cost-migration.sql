-- Coste por jornada por temporada (para balance de finanzas en /temporadas)

alter table public.seasons
  add column if not exists cost_per_jornada numeric(10, 2) not null default 6.00;

comment on column public.seasons.cost_per_jornada is
  'Coste en euros de cada jornada jugada (apuestas del grupo).';
