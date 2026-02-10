-- Permitir a superadmins modificar predicciones de cualquier usuario
-- Ejecuta este script en Supabase SQL Editor

-- Política para que superadmins puedan insertar predicciones de cualquier usuario
drop policy if exists "Quiniela predictions insert by superadmin" on public.quiniela_predictions;
create policy "Quiniela predictions insert by superadmin" 
  on public.quiniela_predictions 
  for insert 
  with check (public.current_user_role() = 'superadmin');

-- Política para que superadmins puedan actualizar predicciones de cualquier usuario
drop policy if exists "Quiniela predictions update by superadmin" on public.quiniela_predictions;
create policy "Quiniela predictions update by superadmin" 
  on public.quiniela_predictions 
  for update 
  using (public.current_user_role() = 'superadmin');
