import { createClient } from "@/lib/supabase/server";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";
import { pointsForPrediction } from "@/lib/quiniela-scoring";
import type { RankingEntry, QuinielaMatch, QuinielaPrediction } from "@/lib/types";

export async function getSeasonRanking(): Promise<RankingEntry[]> {
  const supabase = await createClient();

  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("name")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  const seasonName = activeSeason?.name ?? "2024-25";

  const { data: users } = await supabase
    .from("users")
    .select("id, quiniela_name")
    .not("quiniela_name", "is", null);

  // Misma lógica que el historial por jornada: historial parcial + predicciones para el resto
  const history = await getPointsHistoryBySeason(seasonName);
  const totalsByName: Record<string, number> = {};
  for (const h of history) {
    for (const [name, pts] of Object.entries(h.points_by_user)) {
      totalsByName[name] = (totalsByName[name] ?? 0) + pts;
    }
  }

  const entries: RankingEntry[] = QUINIELA_NAMES.map((name) => {
    const u = (users ?? []).find((x) => x.quiniela_name === name);
    return {
      user_id: u?.id ?? "",
      quiniela_name: u?.quiniela_name ?? name,
      total_points: totalsByName[name] ?? 0,
    };
  });

  return entries.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return (a.quiniela_name ?? "").localeCompare(b.quiniela_name ?? "");
  });
}

export type PointsHistoryEntry = {
  jornada_number: number;
  jornada_id: string;
  points_by_user: Record<string, number>; // quiniela_name -> points
};

export async function getPointsHistory(): Promise<PointsHistoryEntry[]> {
  // Obtener temporada activa y usar la misma función que getPointsHistoryBySeason
  const supabase = await createClient();
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("name")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  const seasonName = activeSeason?.name ?? "2024-25";
  
  // Usar la misma función que calcula puntos desde predicciones
  return getPointsHistoryBySeason(seasonName);
}

/** Obtener historial de puntos por jornada de una temporada específica */
export async function getPointsHistoryBySeason(seasonName: string): Promise<PointsHistoryEntry[]> {
  const supabase = await createClient();

  // Obtener jornadas de la temporada especificada
  const { data: jornadas } = await supabase
    .from("jornadas")
    .select("id, number, is_historical")
    .eq("season", seasonName)
    .order("number", { ascending: true });

  const jornadaIds = (jornadas ?? []).map((j) => j.id);
  if (jornadaIds.length === 0) return [];

  // Obtener matches y predictions de esa temporada (igual que getSeasonRankingBySeason)
  const { data: matches } = await supabase
    .from("quiniela_matches")
    .select("*")
    .in("jornada_id", jornadaIds.length > 0 ? jornadaIds : ["00000000-0000-0000-0000-000000000000"]);

  // Evitar query-string gigantes en PostgREST cuando hay muchas jornadas:
  // traemos predicciones por lotes de match IDs.
  const matchIds = (matches ?? []).map((m) => m.id);
  const predictionChunks: QuinielaPrediction[] = [];
  const chunkSize = 120;
  for (let i = 0; i < matchIds.length; i += chunkSize) {
    const idsChunk = matchIds.slice(i, i + chunkSize);
    if (idsChunk.length === 0) continue;
    const { data: predChunk, error: predErr } = await supabase
      .from("quiniela_predictions")
      .select("*")
      .in("quiniela_match_id", idsChunk);
    if (predErr) {
      throw new Error(`Error obteniendo predicciones (chunk ${i / chunkSize + 1}): ${predErr.message}`);
    }
    predictionChunks.push(...((predChunk ?? []) as QuinielaPrediction[]));
  }

  // Obtener puntos históricos (si existen)
  const { data: pointsHistory } = await supabase
    .from("quiniela_points_history")
    .select("user_id, jornada_id, points")
    .in("jornada_id", jornadaIds.length > 0 ? jornadaIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: users } = await supabase
    .from("users")
    .select("id, quiniela_name")
    .not("quiniela_name", "is", null);

  const userById: Record<string, string> = {};
  for (const u of users ?? []) {
    if (u.quiniela_name) userById[u.id] = u.quiniela_name;
  }

  const jornadaById: Record<string, number> = {};
  const jornadaIsHistoricalById: Record<string, boolean> = {};
  for (const j of jornadas ?? []) {
    jornadaById[j.id] = j.number;
    jornadaIsHistoricalById[j.id] = Boolean(j.is_historical);
  }

  const matchList = (matches ?? []) as QuinielaMatch[];
  const predList = predictionChunks;
  const matchById = new Map(matchList.map((m) => [m.id, m]));

  // Identificar qué jornadas tienen resultados, historial Excel o al menos una predicción (para que la fila exista aunque aún no haya resultados oficiales)
  const jornadasWithResults = new Set<string>();
  const jornadasWithHistory = new Set<string>();
  const jornadasWithPredictions = new Set<string>();

  for (const ph of pointsHistory ?? []) {
    jornadasWithHistory.add(ph.jornada_id);
  }

  for (const p of predList) {
    const m = matchById.get(p.quiniela_match_id);
    if (m) jornadasWithPredictions.add(m.jornada_id);
  }

  for (const jornadaId of jornadaIds) {
    const jornadaMatches = matchList.filter((m) => m.jornada_id === jornadaId);
    const hasResults = jornadaMatches.some(
      (m) =>
        (m.match_order <= 14 && m.result_1x2 != null) ||
        (m.match_order === 15 && m.result_home != null && m.result_away != null)
    );

    if (
      hasResults ||
      jornadasWithHistory.has(jornadaId) ||
      jornadasWithPredictions.has(jornadaId)
    ) {
      jornadasWithResults.add(jornadaId);
    }
  }

  // Mapa de qué jornadas tienen puntos históricos (igual que getSeasonRankingBySeason)
  const historyByJornada: Record<string, Record<string, number>> = {};
  for (const ph of pointsHistory ?? []) {
    if (!historyByJornada[ph.jornada_id]) historyByJornada[ph.jornada_id] = {};
    historyByJornada[ph.jornada_id][ph.user_id] = ph.points;
  }

  const namesSet = new Set<string>(QUINIELA_NAMES as unknown as string[]);
  const expectedPlayersCount = QUINIELA_NAMES.length;
  const hasCompleteHistoryByJornada: Record<string, boolean> = {};
  for (const jornadaId of jornadaIds) {
    const historyCount = Object.keys(historyByJornada[jornadaId] ?? {}).length;
    // Solo dejamos que el histórico "mande" en jornadas históricas.
    // En jornadas normales siempre calculamos desde resultados+predicciones.
    hasCompleteHistoryByJornada[jornadaId] =
      jornadaIsHistoricalById[jornadaId] && historyCount === expectedPlayersCount;
  }

  // Inicializar siempre las 8 columnas; aplicar historial Excel solo donde exista fila (el resto se calcula por predicciones)
  const pointsByJornadaAndUser: Record<string, Record<string, number>> = {};
  for (const jornadaId of Array.from(jornadasWithResults)) {
    const row: Record<string, number> = {};
    for (const name of QUINIELA_NAMES) row[name] = 0;
    // Solo aplicar histórico cuando esté completo (8/8).
    // Si está parcial, se ignora para evitar mezclas inconsistentes como en J32.
    if (hasCompleteHistoryByJornada[jornadaId]) {
      for (const u of users ?? []) {
        if (!u.quiniela_name || !namesSet.has(u.quiniela_name)) continue;
        const h = historyByJornada[jornadaId]?.[u.id];
        if (h != null) row[u.quiniela_name] = h;
      }
    }
    pointsByJornadaAndUser[jornadaId] = row;
  }

  // Partidos 1-14: sumar aciertos por predicción salvo que ese usuario tenga fila en quiniela_points_history para esa jornada
  for (const m of matchList) {
    if (m.match_order === 15) continue;
    const hasResult = m.result_1x2 != null;
    if (!hasResult) continue;

    const jornadaId = m.jornada_id;
    if (!jornadasWithResults.has(jornadaId)) continue;
    if (hasCompleteHistoryByJornada[jornadaId]) continue;

    for (const p of predList) {
      if (p.quiniela_match_id !== m.id) continue;
      const quinielaName = userById[p.user_id];
      if (!quinielaName) continue;

      const pts = pointsForPrediction(m, p);
      if (!namesSet.has(quinielaName)) continue;
      pointsByJornadaAndUser[jornadaId][quinielaName] =
        (pointsByJornadaAndUser[jornadaId][quinielaName] ?? 0) + pts;
    }
  }

  // Pleno 15
  const match15List = matchList.filter((m) => m.match_order === 15);
  for (const m15 of match15List) {
    if (m15.result_home == null || m15.result_away == null) continue;

    const jornadaId = m15.jornada_id;
    if (!jornadasWithResults.has(jornadaId)) continue;
    if (hasCompleteHistoryByJornada[jornadaId]) continue;

    const matches1to14 = matchList.filter(
      (m) => m.jornada_id === jornadaId && m.match_order <= 14
    );
    for (const p of predList) {
      if (p.quiniela_match_id !== m15.id) continue;
      const quinielaName = userById[p.user_id];
      if (!quinielaName) continue;
      if (!namesSet.has(quinielaName)) continue;

      let correct14 = 0;
      for (const m of matches1to14) {
        const pred = predList.find(
          (x) => x.quiniela_match_id === m.id && x.user_id === p.user_id
        );
        if (pred && pointsForPrediction(m, pred) === 1) correct14++;
      }
      const plenoCorrect =
        p.predicted_home === m15.result_home && p.predicted_away === m15.result_away;
      if (correct14 === 14 && plenoCorrect) {
        pointsByJornadaAndUser[jornadaId][quinielaName] =
          (pointsByJornadaAndUser[jornadaId][quinielaName] ?? 0) + 1;
      }
    }
  }

  // Construir resultado - incluir TODAS las jornadas con resultados O puntos históricos
  const result: PointsHistoryEntry[] = [];
  for (const jornadaId of Array.from(jornadasWithResults)) {
    const jornadaNumber = jornadaById[jornadaId];
    if (jornadaNumber == null) continue;

    const pointsByUser = pointsByJornadaAndUser[jornadaId] || {};
    
    result.push({
      jornada_number: jornadaNumber,
      jornada_id: jornadaId,
      points_by_user: pointsByUser,
    });
  }

  return result.sort((a, b) => a.jornada_number - b.jornada_number);
}

/** Obtener ranking de una temporada específica (puede ser archivada) */
export async function getSeasonRankingBySeason(seasonName: string): Promise<RankingEntry[]> {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, quiniela_name")
    .not("quiniela_name", "is", null);

  const history = await getPointsHistoryBySeason(seasonName);
  const totalsByName: Record<string, number> = {};
  for (const h of history) {
    for (const [name, pts] of Object.entries(h.points_by_user)) {
      totalsByName[name] = (totalsByName[name] ?? 0) + pts;
    }
  }

  const entries: RankingEntry[] = QUINIELA_NAMES.map((name) => {
    const u = (users ?? []).find((x) => x.quiniela_name === name);
    return {
      user_id: u?.id ?? "",
      quiniela_name: u?.quiniela_name ?? name,
      total_points: totalsByName[name] ?? 0,
    };
  });

  return entries.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return (a.quiniela_name ?? "").localeCompare(b.quiniela_name ?? "");
  });
}
