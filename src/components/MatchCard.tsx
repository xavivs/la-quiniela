"use client";

import { useState } from "react";
import type { Match } from "@/lib/types";

type Props = {
  match: Match;
  userPrediction?: { predicted_home_score: number; predicted_away_score: number } | null;
  onSubmit: (matchId: string, home: number, away: number) => Promise<void>;
};

export default function MatchCard({ match, userPrediction, onSubmit }: Props) {
  const [home, setHome] = useState(userPrediction?.predicted_home_score ?? 0);
  const [away, setAway] = useState(userPrediction?.predicted_away_score ?? 0);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSubmit(match.id, home, away);
    setLoading(false);
  }

  const hasResult = match.real_home_score !== null && match.real_away_score !== null;
  const date = new Date(match.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>{date}</span>
        {hasResult && (
          <span className="font-medium text-slate-700">
            FT: {match.real_home_score} – {match.real_away_score}
          </span>
        )}
      </div>
      <p className="mb-4 text-center font-medium text-slate-800">
        {match.home_team} vs {match.away_team}
      </p>
      <form onSubmit={handleSubmit} className="flex items-center justify-center gap-2">
        <input
          type="number"
          min={0}
          max={99}
          value={home}
          onChange={(e) => setHome(Number(e.target.value))}
          className="w-14 rounded border border-slate-300 px-2 py-1 text-center text-lg"
        />
        <span className="text-slate-400">–</span>
        <input
          type="number"
          min={0}
          max={99}
          value={away}
          onChange={(e) => setAway(Number(e.target.value))}
          className="w-14 rounded border border-slate-300 px-2 py-1 text-center text-lg"
        />
        <button
          type="submit"
          disabled={loading || hasResult}
          className="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
