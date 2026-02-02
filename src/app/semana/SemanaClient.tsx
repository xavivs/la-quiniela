"use client";

import { useState, useMemo } from "react";
import { OPTIONS_1X2, OPTIONS_PLENO } from "@/lib/quiniela-constants";
import type { Jornada, QuinielaMatch, QuinielaPrediction, User } from "@/lib/types";
import { isCorrect } from "@/lib/quiniela-scoring";

type PredMap = Map<string, QuinielaPrediction>;

type CollectivePleno15 = {
  home: "0" | "1" | "2" | "M";
  away: "0" | "1" | "2" | "M";
  voteCount: number;
};

type FormPred = {
  predicted_1x2?: "1" | "X" | "2";
  predicted_home?: "0" | "1" | "2" | "M";
  predicted_away?: "0" | "1" | "2" | "M";
};

type Props = {
  jornada: Jornada;
  matches: QuinielaMatch[];
  myPredictions: PredMap;
  usersInOrder: User[];
  allPredictions: QuinielaPrediction[];
  correctCountByUser: Record<string, number>;
  collectivePleno15: CollectivePleno15 | null;
  collectivePleno15Correct: boolean;
};

export default function SemanaClient({
  jornada,
  matches,
  myPredictions,
  usersInOrder,
  allPredictions,
  correctCountByUser,
  collectivePleno15,
  collectivePleno15Correct,
}: Props) {
  const hasVoted = useMemo(() => {
    if (matches.length !== 15) return false;
    return matches.every((m) => {
      const p = myPredictions.get(m.id);
      if (m.match_order <= 14) return p?.predicted_1x2 != null;
      return p?.predicted_home != null && p?.predicted_away != null;
    });
  }, [matches, myPredictions]);

  const [formState, setFormState] = useState<Record<string, FormPred>>(() => {
    const init: Record<string, FormPred> = {};
    for (const m of matches) {
      const p = myPredictions.get(m.id);
      if (m.match_order <= 14 && p?.predicted_1x2) {
        init[m.id] = { predicted_1x2: p.predicted_1x2 };
      } else if (m.match_order === 15 && p?.predicted_home != null && p?.predicted_away != null) {
        init[m.id] = { predicted_home: p.predicted_home, predicted_away: p.predicted_away };
      }
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  function set1x2(matchId: string, value: "1" | "X" | "2") {
    setFormState((prev) => ({ ...prev, [matchId]: { ...prev[matchId], predicted_1x2: value } }));
  }
  function setPlenoHome(matchId: string, home: "0" | "1" | "2" | "M") {
    setFormState((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], predicted_home: home, predicted_away: prev[matchId]?.predicted_away },
    }));
  }
  function setPlenoAway(matchId: string, away: "0" | "1" | "2" | "M") {
    setFormState((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], predicted_home: prev[matchId]?.predicted_home, predicted_away: away },
    }));
  }

  async function submitVotes() {
    const allFilled = matches.every((m) => {
      const s = formState[m.id];
      if (m.match_order <= 14) return s?.predicted_1x2 != null;
      return s?.predicted_home != null && s?.predicted_away != null;
    });
    if (!allFilled) {
      alert("Completa los 15 partidos antes de subir los votos.");
      return;
    }
    const list = matches.map((m) => {
      const s = formState[m.id]!;
      if (m.match_order <= 14) {
        return { quiniela_match_id: m.id, predicted_1x2: s.predicted_1x2! };
      }
      return {
        quiniela_match_id: m.id,
        predicted_home: s.predicted_home!,
        predicted_away: s.predicted_away!,
      };
    });
    setSaving(true);
    const res = await fetch("/api/quiniela/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predictions: list }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al subir los votos.");
      return;
    }
    window.location.reload();
  }

  function match15HasResult(m: QuinielaMatch): boolean {
    return m.match_order === 15 && m.result_home != null && m.result_away != null;
  }

  // Aún no has votado: solo formulario para votar (sin ver lo que votan los demás)
  if (!hasVoted) {
    return (
      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Jornada {jornada.number}</h2>
        <p className="mb-4 text-slate-600">
          Pronóstico: 1 = local, X = empate, 2 = visitante. Pleno 15: 0/1/2/M. Rellena los 15 partidos y pulsa &quot;Subir votos&quot;.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2 pr-2 text-center">#</th>
                <th className="py-2 pr-2">Partido</th>
                <th className="py-2 text-left">1 X 2</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const thickBorder = [4, 8, 11, 14].includes(m.match_order);
                return (
                  <tr
                    key={m.id}
                    className={thickBorder ? "border-b-2 border-slate-300" : "border-b border-slate-100"}
                  >
                    <td className="py-2 pr-2 text-center text-slate-500">{m.match_order}</td>
                    <td className="py-2 pr-2 font-medium text-slate-800">
                      {m.home_team} – {m.away_team}
                    </td>
                    <td className="py-2 text-left">
                      {m.match_order <= 14 ? (
                        <div className="flex gap-0">
                          {OPTIONS_1X2.map((opt) => {
                            const selected = formState[m.id]?.predicted_1x2 === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => set1x2(m.id, opt)}
                                className={`w-10 border py-2 text-center text-sm font-medium transition max-md:min-h-[44px] max-md:min-w-[44px] ${
                                  selected
                                    ? "border-slate-800 bg-slate-800 text-white ring-2 ring-slate-800 ring-offset-1"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                } ${opt === "1" ? "rounded-l" : opt === "2" ? "rounded-r" : ""}`}
                                aria-pressed={selected}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-600">Local:</span>
                            <div className="flex gap-0">
                              {OPTIONS_PLENO.map((opt) => {
                                const sel = formState[m.id]?.predicted_home === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setPlenoHome(m.id, opt)}
                                    className={`w-9 border py-1.5 text-center text-sm font-medium transition max-md:min-h-[44px] max-md:min-w-[44px] ${
                                      sel
                                        ? "border-slate-800 bg-slate-800 text-white ring-2 ring-slate-800 ring-offset-1"
                                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                    } ${opt === "0" ? "rounded-l" : opt === "M" ? "rounded-r" : ""}`}
                                    aria-pressed={sel}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-600">Visitante:</span>
                            <div className="flex gap-0">
                              {OPTIONS_PLENO.map((opt) => {
                                const sel = formState[m.id]?.predicted_away === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setPlenoAway(m.id, opt)}
                                    className={`w-9 border py-1.5 text-center text-sm font-medium transition max-md:min-h-[44px] max-md:min-w-[44px] ${
                                      sel
                                        ? "border-slate-800 bg-slate-800 text-white ring-2 ring-slate-800 ring-offset-1"
                                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                    } ${opt === "0" ? "rounded-l" : opt === "M" ? "rounded-r" : ""}`}
                                    aria-pressed={sel}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {formState[m.id]?.predicted_home != null && formState[m.id]?.predicted_away != null && (
                            <p className="text-xs text-slate-500">
                              Pleno: {formState[m.id].predicted_home}-{formState[m.id].predicted_away}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end max-md:mt-6">
          <button
            type="button"
            disabled={saving}
            onClick={submitVotes}
            className="rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 max-md:min-h-[48px] max-md:w-full"
          >
            {saving ? "Subiendo…" : "Subir votos"}
          </button>
        </div>
      </section>
    );
  }

  // Ya has votado: tabla como en la captura (Puntos, Nombre, partidos; "-" si no ha votado)
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-semibold text-slate-800">Resultados Semana</h2>
      <p className="mb-3 text-sm text-slate-600">
        Puntos: partidos 1-14 + pleno 15 (solo suma si has acertado los 14 anteriores). Cada columna es lo que ha votado esa persona. &quot;-&quot; = aún no ha votado.
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/80">
              <th className="px-3 py-2 text-left font-medium text-slate-700">Puntos</th>
              {usersInOrder.map((u) => (
                <td key={u.id} className="px-2 py-2 text-center">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">
                    {correctCountByUser[u.id] ?? 0}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left font-medium text-slate-700">Nombre</th>
              {usersInOrder.map((u) => (
                <th key={u.id} className="px-2 py-2 text-center font-medium text-slate-700">
                  {u.quiniela_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const thickBorder = [4, 8, 11, 14].includes(m.match_order);
              return (
              <tr
                key={m.id}
                className={`hover:bg-slate-50/50 ${
                  thickBorder ? "border-b-2 border-slate-300" : "border-b border-slate-100"
                }`}
              >
                <td className="px-3 py-2 font-medium text-slate-800">
                  {m.match_order}. {m.home_team} – {m.away_team}
                </td>
                {m.match_order === 15 ? (
                  <td
                    colSpan={usersInOrder.length}
                    className="px-2 py-2 text-center"
                  >
                    {collectivePleno15 ? (
                      <span
                        className={
                          match15HasResult(m)
                            ? collectivePleno15Correct
                              ? "font-medium text-green-700"
                              : "text-red-700"
                            : "text-slate-700"
                        }
                      >
                        {collectivePleno15.home}-{collectivePleno15.away}
                        {match15HasResult(m) && (collectivePleno15Correct ? " ✓" : " ✗")}
                      </span>
                    ) : (
                      "–"
                    )}
                  </td>
                ) : (
                  usersInOrder.map((u) => {
                    const pred = allPredictions.find(
                      (p) => p.user_id === u.id && p.quiniela_match_id === m.id
                    );
                    const correctResult = pred && isCorrect(m, pred);
                    const hasResult = m.result_1x2 != null;
                    const label = pred?.predicted_1x2 ?? "–";
                    return (
                      <td
                        key={u.id}
                        className={`px-2 py-2 text-center ${
                          !hasResult
                            ? "text-slate-600"
                            : correctResult
                              ? "bg-green-100 text-green-800 font-medium"
                              : "bg-red-100 text-red-800 font-medium"
                        }`}
                        title={hasResult ? (correctResult ? "Acierto" : "Fallo") : ""}
                      >
                        {label}
                      </td>
                    );
                  })
                )}
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
