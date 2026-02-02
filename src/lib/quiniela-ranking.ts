import { createClient } from "@/lib/supabase/server";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";
import { pointsForPrediction } from "@/lib/quiniela-scoring";
import type { RankingEntry, QuinielaMatch, QuinielaPrediction } from "@/lib/types";

export async function getSeasonRanking(): Promise<RankingEntry[]> {
  const supabase = await createClient();

  // Obtener temporada activa
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

  // Obtener jornadas de la temporada activa
  const { data: jornadas } = await supabase
    .from("jornadas")
    .select("id")
    .eq("season", seasonName);

  const jornadaIds = (jornadas ?? []).map((j) => j.id);

  // Obtener matches y predictions solo de la temporada activa
  const { data: matches } = await supabase
    .from("quiniela_matches")
    .select("*")
    .in("jornada_id", jornadaIds.length > 0 ? jornadaIds : ["00000000-0000-0000-0000-000000000000"]); // Empty array fallback

  const { data: predictions } = await supabase
    .from("quiniela_predictions")
    .select("*")
    .in("quiniela_match_id", (matches ?? []).map((m) => m.id));

  // Filtrar puntos históricos solo de jornadas de la temporada activa
  const { data: pointsHistory } = await supabase
    .from("quiniela_points_history")
    .select("user_id, jornada_id, points")
    .in("jornada_id", jornadaIds.length > 0 ? jornadaIds : ["00000000-0000-0000-0000-000000000000"]);

  const matchList = (matches ?? []) as QuinielaMatch[];
  const predList = (predictions ?? []) as QuinielaPrediction[];

  const pointsByUser: Record<string, number> = {};
  for (const u of users ?? []) {
    pointsByUser[u.id] = 0;
  }

  // Sumar puntos históricos primero (si existen, tienen prioridad para esas jornadas)
  const historyByJornada: Record<string, Record<string, number>> = {};
  for (const ph of pointsHistory ?? []) {
    if (!historyByJornada[ph.jornada_id]) historyByJornada[ph.jornada_id] = {};
    historyByJornada[ph.jornada_id][ph.user_id] = ph.points;
    pointsByUser[ph.user_id] = (pointsByUser[ph.user_id] ?? 0) + ph.points;
  }

  // Partidos 1-14: 1 punto por acierto (solo si no hay puntos históricos para esa jornada)
  for (const m of matchList) {
    if (m.match_order === 15) continue;
    const hasResult = m.result_1x2 != null;
    if (!hasResult) continue;
    // Si esta jornada tiene puntos históricos, saltarla (ya se sumaron arriba)
    if (historyByJornada[m.jornada_id]) continue;
    for (const p of predList) {
      if (p.quiniela_match_id !== m.id) continue;
      const pts = pointsForPrediction(m, p);
      pointsByUser[p.user_id] = (pointsByUser[p.user_id] ?? 0) + pts;
    }
  }

  // Pleno 15: solo suma si has acertado los 14 de esa jornada y aciertas el pleno
  // (solo si no hay puntos históricos para esa jornada)
  const match15List = matchList.filter((m) => m.match_order === 15);
  for (const m15 of match15List) {
    if (m15.result_home == null || m15.result_away == null) continue;
    // Si esta jornada tiene puntos históricos, saltarla (ya se sumaron arriba)
    if (historyByJornada[m15.jornada_id]) continue;
    const matches1to14 = matchList.filter(
      (m) => m.jornada_id === m15.jornada_id && m.match_order <= 14
    );
    for (const p of predList) {
      if (p.quiniela_match_id !== m15.id) continue;
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
        pointsByUser[p.user_id] = (pointsByUser[p.user_id] ?? 0) + 1;
      }
    }
  }

  const entries: RankingEntry[] = QUINIELA_NAMES.map((name) => {
    const u = (users ?? []).find((x) => x.quiniela_name === name);
    return {
      user_id: u?.id ?? "",
      quiniela_name: u?.quiniela_name ?? name,
      total_points: u ? (pointsByUser[u.id] ?? 0) : 0,
    };
  });

  // Ordenar por puntuación total (mayor primero); en empate, por orden de nombre
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
    .select("id, number")
    .eq("season", seasonName)
    .order("number", { ascending: true });

  const jornadaIds = (jornadas ?? []).map((j) => j.id);
  if (jornadaIds.length === 0) return [];

  // Obtener matches y predictions de esa temporada (igual que getSeasonRankingBySeason)
  const { data: matches } = await supabase
    .from("quiniela_matches")
    .select("*")
    .in("jornada_id", jornadaIds.length > 0 ? jornadaIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: predictions } = await supabase
    .from("quiniela_predictions")
    .select("*")
    .in("quiniela_match_id", (matches ?? []).map((m) => m.id));

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
  for (const j of jornadas ?? []) {
    jornadaById[j.id] = j.number;
  }

  const matchList = (matches ?? []) as QuinielaMatch[];
  const predList = (predictions ?? []) as QuinielaPrediction[];

  // Identificar qué jornadas tienen resultados O puntos históricos
  const jornadasWithResults = new Set<string>();
  const jornadasWithHistory = new Set<string>();
  
  // Primero identificar jornadas con puntos históricos
  for (const ph of pointsHistory ?? []) {
    jornadasWithHistory.add(ph.jornada_id);
  }
  
  // Identificar jornadas con resultados
  for (const jornadaId of jornadaIds) {
    const jornadaMatches = matchList.filter((m) => m.jornada_id === jornadaId);
    const hasResults = jornadaMatches.some(
      (m) => (m.match_order <= 14 && m.result_1x2 != null) || (m.match_order === 15 && m.result_home != null && m.result_away != null)
    );
    
    // Incluir jornadas con resultados O con puntos históricos
    if (hasResults || jornadasWithHistory.has(jornadaId)) {
      jornadasWithResults.add(jornadaId);
    }
  }

  // Mapa de qué jornadas tienen puntos históricos (igual que getSeasonRankingBySeason)
  const historyByJornada: Record<string, Record<string, number>> = {};
  for (const ph of pointsHistory ?? []) {
    if (!historyByJornada[ph.jornada_id]) historyByJornada[ph.jornada_id] = {};
    historyByJornada[ph.jornada_id][ph.user_id] = ph.points;
  }

  // Inicializar puntos por jornada y usuario
  const pointsByJornadaAndUser: Record<string, Record<string, number>> = {};
  for (const jornadaId of Array.from(jornadasWithResults)) {
    pointsByJornadaAndUser[jornadaId] = {};
    for (const u of users ?? []) {
      if (u.quiniela_name) {
        // Si hay puntos históricos para este usuario en esta jornada, usarlos
        if (historyByJornada[jornadaId] && historyByJornada[jornadaId][u.id] != null) {
          pointsByJornadaAndUser[jornadaId][u.quiniela_name] = historyByJornada[jornadaId][u.id];
        } else {
          // Inicializar en 0, se calculará desde predicciones si la jornada tiene resultados
          pointsByJornadaAndUser[jornadaId][u.quiniela_name] = 0;
        }
      }
    }
  }

  // Calcular puntos desde predicciones para jornadas SIN puntos históricos (igual que getSeasonRankingBySeason)
  // Partidos 1-14
  for (const m of matchList) {
    if (m.match_order === 15) continue;
    const hasResult = m.result_1x2 != null;
    if (!hasResult) continue;
    
    const jornadaId = m.jornada_id;
    if (!jornadasWithResults.has(jornadaId)) continue;
    
    // Si esta jornada tiene puntos históricos para TODOS los usuarios, saltarla
    // Pero si solo algunos usuarios tienen puntos históricos, calcular para los demás
    const jornadaHasHistoryForAll = jornadasWithHistory.has(jornadaId) && 
      historyByJornada[jornadaId] && 
      Object.keys(historyByJornada[jornadaId]).length === users?.length;
    
    if (jornadaHasHistoryForAll) continue;

    for (const p of predList) {
      if (p.quiniela_match_id !== m.id) continue;
      const quinielaName = userById[p.user_id];
      if (!quinielaName) continue;
      
      // Si este usuario ya tiene puntos históricos para esta jornada, no calcular
      if (historyByJornada[jornadaId] && historyByJornada[jornadaId][p.user_id] != null) {
        continue;
      }
      
      const pts = pointsForPrediction(m, p);
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
    
    // Si esta jornada tiene puntos históricos para TODOS los usuarios, saltarla
    const jornadaHasHistoryForAll = jornadasWithHistory.has(jornadaId) && 
      historyByJornada[jornadaId] && 
      Object.keys(historyByJornada[jornadaId]).length === users?.length;
    
    if (jornadaHasHistoryForAll) continue;

    const matches1to14 = matchList.filter(
      (m) => m.jornada_id === jornadaId && m.match_order <= 14
    );
    for (const p of predList) {
      if (p.quiniela_match_id !== m15.id) continue;
      const quinielaName = userById[p.user_id];
      if (!quinielaName) continue;
      
      // Si este usuario ya tiene puntos históricos para esta jornada, no calcular
      if (historyByJornada[jornadaId] && historyByJornada[jornadaId][p.user_id] != null) {
        continue;
      }

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

  // Obtener jornadas de la temporada especificada
  const { data: jornadas } = await supabase
    .from("jornadas")
    .select("id")
    .eq("season", seasonName);

  const jornadaIds = (jornadas ?? []).map((j) => j.id);

  // Obtener matches y predictions solo de esa temporada
  const { data: matches } = await supabase
    .from("quiniela_matches")
    .select("*")
    .in("jornada_id", jornadaIds.length > 0 ? jornadaIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: predictions } = await supabase
    .from("quiniela_predictions")
    .select("*")
    .in("quiniela_match_id", (matches ?? []).map((m) => m.id));

  // Filtrar puntos históricos solo de jornadas de esa temporada
  const { data: pointsHistory } = await supabase
    .from("quiniela_points_history")
    .select("user_id, jornada_id, points")
    .in("jornada_id", jornadaIds.length > 0 ? jornadaIds : ["00000000-0000-0000-0000-000000000000"]);

  const matchList = (matches ?? []) as QuinielaMatch[];
  const predList = (predictions ?? []) as QuinielaPrediction[];

  const pointsByUser: Record<string, number> = {};
  for (const u of users ?? []) {
    pointsByUser[u.id] = 0;
  }

  // Sumar puntos históricos primero (si existen, tienen prioridad para esas jornadas)
  const historyByJornada: Record<string, Record<string, number>> = {};
  for (const ph of pointsHistory ?? []) {
    if (!historyByJornada[ph.jornada_id]) historyByJornada[ph.jornada_id] = {};
    historyByJornada[ph.jornada_id][ph.user_id] = ph.points;
    pointsByUser[ph.user_id] = (pointsByUser[ph.user_id] ?? 0) + ph.points;
  }

  // Partidos 1-14: 1 punto por acierto (solo si no hay puntos históricos para esa jornada)
  for (const m of matchList) {
    if (m.match_order === 15) continue;
    const hasResult = m.result_1x2 != null;
    if (!hasResult) continue;
    // Si esta jornada tiene puntos históricos, saltarla (ya se sumaron arriba)
    if (historyByJornada[m.jornada_id]) continue;
    for (const p of predList) {
      if (p.quiniela_match_id !== m.id) continue;
      const pts = pointsForPrediction(m, p);
      pointsByUser[p.user_id] = (pointsByUser[p.user_id] ?? 0) + pts;
    }
  }

  // Pleno 15: solo suma si has acertado los 14 de esa jornada y aciertas el pleno
  const match15List = matchList.filter((m) => m.match_order === 15);
  for (const m15 of match15List) {
    if (m15.result_home == null || m15.result_away == null) continue;
    // Si esta jornada tiene puntos históricos, saltarla (ya se sumaron arriba)
    if (historyByJornada[m15.jornada_id]) continue;
    const matches1to14 = matchList.filter(
      (m) => m.jornada_id === m15.jornada_id && m.match_order <= 14
    );
    for (const p of predList) {
      if (p.quiniela_match_id !== m15.id) continue;
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
        pointsByUser[p.user_id] = (pointsByUser[p.user_id] ?? 0) + 1;
      }
    }
  }

  const entries: RankingEntry[] = QUINIELA_NAMES.map((name) => {
    const u = (users ?? []).find((x) => x.quiniela_name === name);
    return {
      user_id: u?.id ?? "",
      quiniela_name: u?.quiniela_name ?? name,
      total_points: u ? (pointsByUser[u.id] ?? 0) : 0,
    };
  });

  // Ordenar por puntuación total (mayor primero); en empate, por orden de nombre
  return entries.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return (a.quiniela_name ?? "").localeCompare(b.quiniela_name ?? "");
  });
}
