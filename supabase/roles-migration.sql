-- =============================================================================
-- Roles: user, admin, superadmin. Ejecutar en Supabase SQL Editor.
-- =============================================================================
-- Después de ejecutar, asigna el primer superadmin con:
--   update public.users set role = 'superadmin' where email = 'tu@email.com';
-- =============================================================================

-- Columna role en users (user | admin | superadmin)
alter table public.users add column if not exists role text default 'user';
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('user', 'admin', 'superadmin'));

-- Función para usar en RLS: rol del usuario actual
create or replace function public.current_user_role()
returns text as $$
  select role from public.users where id = auth.uid();
$$ language sql security definer stable;

-- Users: solo superadmin puede cambiar el rol de otros; usuarios pueden actualizar su fila pero no su propio rol
drop policy if exists "Users can update own row" on public.users;
create policy "Users can update own row" on public.users for update
  using (auth.uid() = id or public.current_user_role() = 'superadmin')
  with check (
    (auth.uid() = id and role = (select role from public.users where id = auth.uid()))
    or (public.current_user_role() = 'superadmin')
  );

-- Jornadas: solo admin/superadmin pueden insertar, actualizar y eliminar
drop policy if exists "Jornadas insert by authenticated" on public.jornadas;
create policy "Jornadas insert by admin" on public.jornadas for insert
  with check (public.current_user_role() in ('admin', 'superadmin'));

drop policy if exists "Jornadas update by authenticated" on public.jornadas;
create policy "Jornadas update by admin" on public.jornadas for update
  using (public.current_user_role() in ('admin', 'superadmin'));

drop policy if exists "Jornadas delete by authenticated" on public.jornadas;
create policy "Jornadas delete by admin" on public.jornadas for delete
  using (public.current_user_role() in ('admin', 'superadmin'));

-- Quiniela_matches: solo admin/superadmin pueden insertar y actualizar (resultados)
drop policy if exists "Quiniela matches insert by authenticated" on public.quiniela_matches;
create policy "Quiniela matches insert by admin" on public.quiniela_matches for insert
  with check (public.current_user_role() in ('admin', 'superadmin'));

drop policy if exists "Quiniela matches update by authenticated" on public.quiniela_matches;
create policy "Quiniela matches update by admin" on public.quiniela_matches for update
  using (public.current_user_role() in ('admin', 'superadmin'));

-- Trigger: nuevos usuarios reciben role = 'user'
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

-- Listo. Asigna tu usuario como superadmin:
-- update public.users set role = 'superadmin' where email = 'TU_EMAIL';
