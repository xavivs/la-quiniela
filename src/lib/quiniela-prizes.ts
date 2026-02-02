import { createClient } from "@/lib/supabase/server";

/** Obtener premios totales por usuario de una temporada */
export async function getPrizesBySeason(seasonName: string): Promise<Record<string, number>> {
  const supabase = await createClient();

  // Obtener jornadas de la temporada
  const { data: jornadas } = await supabase
    .from("jornadas")
    .select("id")
    .eq("season", seasonName);

  const jornadaIds = (jornadas ?? []).map((j) => j.id);
  if (jornadaIds.length === 0) return {};

  // Obtener premios
  const { data: prizes } = await supabase
    .from("quiniela_prizes")
    .select("user_id, amount")
    .in("jornada_id", jornadaIds.length > 0 ? jornadaIds : ["00000000-0000-0000-0000-000000000000"]);

  // Obtener usuarios para mapear user_id a quiniela_name
  const { data: users } = await supabase
    .from("users")
    .select("id, quiniela_name")
    .not("quiniela_name", "is", null);

  const userById: Record<string, string> = {};
  for (const u of users ?? []) {
    if (u.quiniela_name) userById[u.id] = u.quiniela_name;
  }

  // Sumar premios por quiniela_name
  const prizesByUser: Record<string, number> = {};
  for (const p of prizes ?? []) {
    const quinielaName = userById[p.user_id];
    if (quinielaName) {
      prizesByUser[quinielaName] = (prizesByUser[quinielaName] ?? 0) + Number(p.amount);
    }
  }

  return prizesByUser;
}

/** Premios por jornada: para cada jornada_id, qué usuarios cobraron y cuánto (por quiniela_name) */
export async function getPrizesPerJornada(
  seasonName: string
): Promise<Record<string, Record<string, number>>> {
  const supabase = await createClient();

  const { data: jornadas } = await supabase
    .from("jornadas")
    .select("id")
    .eq("season", seasonName);

  const jornadaIds = (jornadas ?? []).map((j) => j.id);
  if (jornadaIds.length === 0) return {};

  const { data: prizes } = await supabase
    .from("quiniela_prizes")
    .select("jornada_id, user_id, amount")
    .in("jornada_id", jornadaIds);

  const { data: users } = await supabase
    .from("users")
    .select("id, quiniela_name")
    .not("quiniela_name", "is", null);

  const userById: Record<string, string> = {};
  for (const u of users ?? []) {
    if (u.quiniela_name) userById[u.id] = u.quiniela_name;
  }

  const byJornada: Record<string, Record<string, number>> = {};
  for (const p of prizes ?? []) {
    const name = userById[p.user_id];
    if (!name) continue;
    if (!byJornada[p.jornada_id]) byJornada[p.jornada_id] = {};
    byJornada[p.jornada_id][name] = (byJornada[p.jornada_id][name] ?? 0) + Number(p.amount);
  }
  return byJornada;
}
