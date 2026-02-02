"use client";

import { useState } from "react";

export default function CreateMatchForm() {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        home_team: homeTeam,
        away_team: awayTeam,
        date: date || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Failed to create match");
      return;
    }
    setMessage("Match created.");
    setHomeTeam("");
    setAwayTeam("");
    setDate("");
    window.location.reload();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">
        Create match
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Home team
          </label>
          <input
            type="text"
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            required
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Team A"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Away team
          </label>
          <input
            type="text"
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            required
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Team B"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Date</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-slate-800 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create match"}
        </button>
      </form>
      {message && (
        <p className="mt-3 text-sm text-slate-600">{message}</p>
      )}
    </div>
  );
}
