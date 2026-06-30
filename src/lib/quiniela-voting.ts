import type { SupabaseClient } from "@supabase/supabase-js";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";

type MatchRow = { id: string; match_order: number };
type PredRow = {
  user_id: string;
  quiniela_match_id: string;
  predicted_1x2?: string | null;
  predicted_home?: string | null;
  predicted_away?: string | null;
};

export function userHasCompleteVote(
  userId: string,
  matches: MatchRow[],
  predictions: PredRow[]
): boolean {
  if (matches.length !== 15) return false;
  const userPreds = predictions.filter((p) => p.user_id === userId);
  return matches.every((m) => {
    const p = userPreds.find((pr) => pr.quiniela_match_id === m.id);
    if (!p) return false;
    if (m.match_order <= 14) return p.predicted_1x2 != null;
    return p.predicted_home != null && p.predicted_away != null;
  });
}

/** Cierra la votación si los 8 jugadores de la quiniela han votado los 15 partidos. */
export async function maybeCloseVotingWhenAllVoted(
  supabase: SupabaseClient,
  jornadaId: string
): Promise<void> {
  const { data: matches } = await supabase
    .from("quiniela_matches")
    .select("id, match_order")
    .eq("jornada_id", jornadaId)
    .order("match_order", { ascending: true });

  if (!matches || matches.length !== 15) return;

  const matchIds = matches.map((m) => m.id);
  const { data: users } = await supabase
    .from("users")
    .select("id, quiniela_name")
    .in("quiniela_name", [...QUINIELA_NAMES]);

  if (!users || users.length < QUINIELA_NAMES.length) return;

  const { data: predictions } = await supabase
    .from("quiniela_predictions")
    .select("user_id, quiniela_match_id, predicted_1x2, predicted_home, predicted_away")
    .in("quiniela_match_id", matchIds);

  const allVoted = users.every((u) =>
    userHasCompleteVote(u.id, matches, predictions ?? [])
  );

  if (allVoted) {
    await supabase.from("jornadas").update({ voting_open: false }).eq("id", jornadaId);
  }
}

/** Cierra la votación de las demás jornadas de la temporada al crear una nueva. */
export async function closeVotingForOtherJornadas(
  supabase: SupabaseClient,
  season: string,
  exceptJornadaId: string
): Promise<void> {
  await supabase
    .from("jornadas")
    .update({ voting_open: false })
    .eq("season", season)
    .neq("id", exceptJornadaId)
    .or("is_historical.is.null,is_historical.eq.false");
}
