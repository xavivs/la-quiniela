"use client";

import MatchCard from "@/components/MatchCard";
import type { Match } from "@/lib/types";

type PredictionRow = {
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
};

type Props = {
  matches: Match[];
  predictionByMatch: Map<string, PredictionRow>;
  userId: string;
};

export default function DashboardClient({
  matches,
  predictionByMatch,
  userId,
}: Props) {
  async function submitPrediction(matchId: string, home: number, away: number) {
    await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: matchId,
        predicted_home_score: home,
        predicted_away_score: away,
      }),
    });
    window.location.reload();
  }

  if (!matches.length) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
        No matches yet. Admin can add matches from the Admin page.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          userPrediction={predictionByMatch.get(match.id) ?? null}
          onSubmit={submitPrediction}
        />
      ))}
    </div>
  );
}
