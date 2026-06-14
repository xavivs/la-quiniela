import { createClient } from "@/lib/supabase/server";
import {
  getPointsHistoryBySeason,
  getSeasonRankingBySeason,
  type PointsHistoryEntry,
} from "@/lib/quiniela-ranking";
import { getPrizesBySeason, getPrizesPerJornada } from "@/lib/quiniela-prizes";
import type { RankingEntry, Season } from "@/lib/types";

export type SeasonFinances = {
  jornadas_played: number;
  cost_per_jornada: number;
  total_cost: number;
  total_prizes: number;
  profit: number;
};

export type SeasonSummary = {
  season: Pick<Season, "id" | "name" | "is_active" | "created_at" | "archived_at"> & {
    cost_per_jornada: number;
  };
  ranking: RankingEntry[];
  history: PointsHistoryEntry[];
  prizesByUser: Record<string, number>;
  prizesPerJornada: Record<string, Record<string, number>>;
  finances: SeasonFinances;
};

async function countJornadasPlayed(seasonName: string): Promise<number> {
  const supabase = await createClient();
  const { data: jornadas } = await supabase
    .from("jornadas")
    .select("id")
    .eq("season", seasonName);

  const jornadaIds = (jornadas ?? []).map((j) => j.id);
  if (jornadaIds.length === 0) return 0;

  const { data: matches } = await supabase
    .from("quiniela_matches")
    .select("jornada_id, match_order, result_1x2, result_home, result_away")
    .in("jornada_id", jornadaIds);

  const played = new Set<string>();
  for (const m of matches ?? []) {
    const hasResult =
      (m.match_order <= 14 && m.result_1x2 != null) ||
      (m.match_order === 15 && m.result_home != null && m.result_away != null);
    if (hasResult) played.add(m.jornada_id);
  }
  return played.size;
}

export async function getSeasonSummary(seasonName: string): Promise<SeasonSummary | null> {
  const supabase = await createClient();
  const { data: seasonRow } = await supabase
    .from("seasons")
    .select("id, name, is_active, created_at, archived_at, cost_per_jornada")
    .eq("name", seasonName)
    .single();

  if (!seasonRow) return null;

  const costPerJornada = Number(seasonRow.cost_per_jornada ?? 6);

  const [ranking, history, prizesByUser, prizesPerJornada, jornadasPlayed] =
    await Promise.all([
      getSeasonRankingBySeason(seasonName),
      getPointsHistoryBySeason(seasonName),
      getPrizesBySeason(seasonName),
      getPrizesPerJornada(seasonName),
      countJornadasPlayed(seasonName),
    ]);

  const totalPrizes = Object.values(prizesByUser).reduce((a, b) => a + b, 0);
  const totalCost = jornadasPlayed * costPerJornada;

  return {
    season: {
      id: seasonRow.id,
      name: seasonRow.name,
      is_active: seasonRow.is_active,
      created_at: seasonRow.created_at,
      archived_at: seasonRow.archived_at,
      cost_per_jornada: costPerJornada,
    },
    ranking,
    history,
    prizesByUser,
    prizesPerJornada,
    finances: {
      jornadas_played: jornadasPlayed,
      cost_per_jornada: costPerJornada,
      total_cost: totalCost,
      total_prizes: totalPrizes,
      profit: totalPrizes - totalCost,
    },
  };
}

export async function listSeasons(): Promise<Season[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, name, is_active, created_at, archived_at, cost_per_jornada")
    .order("created_at", { ascending: false });
  return (data ?? []) as Season[];
}
