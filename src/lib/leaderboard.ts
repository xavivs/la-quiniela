import { createClient } from "@/lib/supabase/server";
import { getPredictionPoints } from "./scoring";
import type { LeaderboardEntry } from "./types";

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();

  const { data: users } = await supabase.from("users").select("id, email");
  const { data: predictions } = await supabase
    .from("predictions")
    .select("user_id, match_id, predicted_home_score, predicted_away_score");
  const { data: matches } = await supabase
    .from("matches")
    .select("id, real_home_score, real_away_score");

  const matchScores = new Map(
    matches?.map((m) => [m.id, { home: m.real_home_score, away: m.real_away_score }]) ?? []
  );

  const pointsByUser = new Map<string, number>();

  for (const u of users ?? []) {
    pointsByUser.set(u.id, 0);
  }

  for (const p of predictions ?? []) {
    const m = matchScores.get(p.match_id);
    if (!m) continue;
    const pts = getPredictionPoints(
      p.predicted_home_score,
      p.predicted_away_score,
      m.home,
      m.away
    );
    pointsByUser.set(
      p.user_id,
      (pointsByUser.get(p.user_id) ?? 0) + pts
    );
  }

  const result: LeaderboardEntry[] = (users ?? []).map((u) => ({
    user_id: u.id,
    email: u.email,
    total_points: pointsByUser.get(u.id) ?? 0,
  }));

  result.sort((a, b) => b.total_points - a.total_points);
  return result;
}
