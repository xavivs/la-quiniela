"use client";

import { useState } from "react";
import { OPTIONS_1X2, OPTIONS_PLENO, QUINIELA_NAMES } from "@/lib/quiniela-constants";
import type { Jornada } from "@/lib/types";
import type { QuinielaMatch, QuinielaPrediction, User } from "@/lib/types";

type QMatch = QuinielaMatch & { id: string };
type QPrediction = QuinielaPrediction & { id: string };

type PredictionState = {
  predicted_1x2?: "1" | "X" | "2" | null;
  predicted_home?: "0" | "1" | "2" | "M" | null;
  predicted_away?: "0" | "1" | "2" | "M" | null;
};

type Props = {
  jornadas: Array<Jornada & { matches: QMatch[] }>;
  users: User[];
  predictions: QPrediction[];
};

export default function EditPredictionsSection({ jornadas, users, predictions }: Props) {
  const [expandedJornada, setExpandedJornada] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Crear mapa de predicciones: user_id -> match_id -> prediction
  const predictionsMap = new Map<string, Map<string, QPrediction>>();
  for (const pred of predictions) {
    if (!predictionsMap.has(pred.user_id)) {
      predictionsMap.set(pred.user_id, new Map());
    }
    predictionsMap.get(pred.user_id)!.set(pred.quiniela_match_id, pred);
  }

  // Estado de predicciones editables: jornada_id -> user_id -> match_id -> PredictionState
  const [predictionStates, setPredictionStates] = useState<
    Record<string, Record<string, Record<string, PredictionState>>>
  >(() => {
    const init: Record<string, Record<string, Record<string, PredictionState>>> = {};
    for (const j of jornadas) {
      init[j.id] = {};
      for (const u of users) {
        init[j.id][u.id] = {};
        for (const m of j.matches) {
          const existing = predictionsMap.get(u.id)?.get(m.id);
          if (m.match_order <= 14) {
            init[j.id][u.id][m.id] = {
              predicted_1x2: (existing?.predicted_1x2 as "1" | "X" | "2" | null) ?? null,
            };
          } else {
            init[j.id][u.id][m.id] = {
              predicted_home: (existing?.predicted_home as "0" | "1" | "2" | "M" | null) ?? null,
              predicted_away: (existing?.predicted_away as "0" | "1" | "2" | "M" | null) ?? null,
            };
          }
        }
      }
    }
    return init;
  });

  function setPrediction1x2(jornadaId: string, userId: string, matchId: string, value: "1" | "X" | "2" | null) {
    setPredictionStates((prev) => ({
      ...prev,
      [jornadaId]: {
        ...prev[jornadaId],
        [userId]: {
          ...prev[jornadaId]?.[userId],
          [matchId]: { ...prev[jornadaId]?.[userId]?.[matchId], predicted_1x2: value },
        },
      },
    }));
  }

  function setPredictionPlenoHome(
    jornadaId: string,
    userId: string,
    matchId: string,
    home: "0" | "1" | "2" | "M" | null
  ) {
    setPredictionStates((prev) => ({
      ...prev,
      [jornadaId]: {
        ...prev[jornadaId],
        [userId]: {
          ...prev[jornadaId]?.[userId],
          [matchId]: {
            ...prev[jornadaId]?.[userId]?.[matchId],
            predicted_home: home,
            predicted_away: prev[jornadaId]?.[userId]?.[matchId]?.predicted_away,
          },
        },
      },
    }));
  }

  function setPredictionPlenoAway(
    jornadaId: string,
    userId: string,
    matchId: string,
    away: "0" | "1" | "2" | "M" | null
  ) {
    setPredictionStates((prev) => ({
      ...prev,
      [jornadaId]: {
        ...prev[jornadaId],
        [userId]: {
          ...prev[jornadaId]?.[userId],
          [matchId]: {
            ...prev[jornadaId]?.[userId]?.[matchId],
            predicted_away: away,
            predicted_home: prev[jornadaId]?.[userId]?.[matchId]?.predicted_home,
          },
        },
      },
    }));
  }

  async function saveUserPredictions(jornadaId: string, userId: string, matches: QMatch[]) {
    const userState = predictionStates[jornadaId]?.[userId] ?? {};
    const predictionsToSave = matches
      .map((m) => {
        const state = userState[m.id];
        if (m.match_order <= 14) {
          const v = state?.predicted_1x2;
          return v != null ? { quiniela_match_id: m.id, predicted_1x2: v } : null;
        }
        const h = state?.predicted_home;
        const a = state?.predicted_away;
        return h != null && a != null
          ? { quiniela_match_id: m.id, predicted_home: h, predicted_away: a }
          : null;
      })
      .filter((p): p is NonNullable<typeof p> => p != null);

    if (predictionsToSave.length === 0) {
      alert("No hay predicciones para guardar.");
      return;
    }

    setSaving(`${jornadaId}-${userId}`);
    const res = await fetch("/api/quiniela/predictions/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, predictions: predictionsToSave }),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al guardar predicciones.");
      return;
    }
    window.location.reload();
  }

  // Ordenar usuarios según QUINIELA_NAMES
  const usersInOrder = QUINIELA_NAMES.map((name) => users.find((u) => u.quiniela_name === name)).filter(Boolean) as User[];

  return (
    <div className="space-y-4">
      {jornadas.length === 0 ? (
        <p className="text-sm text-slate-500">No hay jornadas disponibles.</p>
      ) : (
        jornadas.map((j) => {
          const isExpanded = expandedJornada === j.id;
          const isHistorical = j.is_historical ?? false;
          return (
            <div
              key={j.id}
              className={`rounded-lg overflow-hidden ${
                isHistorical
                  ? "border-2 border-amber-300 bg-amber-50/30"
                  : "border border-slate-200 bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedJornada(isExpanded ? null : j.id)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left max-md:px-3 max-md:py-2.5 ${
                  isHistorical ? "hover:bg-amber-50/50" : "hover:bg-slate-50"
                }`}
              >
                <span className="font-medium text-slate-800 max-md:text-sm">
                  Jornada {j.number}
                  {isHistorical && (
                    <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Histórica
                    </span>
                  )}
                </span>
                <svg
                  className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div
                  className={`border-t p-4 max-md:p-3 ${
                    isHistorical
                      ? "border-amber-200 bg-amber-50/20"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  {isHistorical ? (
                    <p className="text-sm text-slate-500 max-md:text-xs">
                      Las jornadas históricas no tienen predicciones de usuarios.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {usersInOrder.map((user) => {
                        const userState = predictionStates[j.id]?.[user.id] ?? {};
                        return (
                          <div key={user.id} className="rounded-lg border border-slate-200 bg-white p-4 max-md:p-3">
                            <div className="mb-3 flex items-center justify-between max-md:mb-2">
                              <h3 className="font-semibold text-slate-800 max-md:text-sm">
                                {user.quiniela_name}
                              </h3>
                              <button
                                type="button"
                                disabled={saving === `${j.id}-${user.id}`}
                                onClick={() => saveUserPredictions(j.id, user.id, j.matches)}
                                className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 max-md:px-2 max-md:py-1"
                              >
                                {saving === `${j.id}-${user.id}` ? "Guardando…" : "Guardar"}
                              </button>
                            </div>
                            {/* Desktop: tabla */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-200 text-left text-slate-600">
                                    <th className="py-2 pr-2">#</th>
                                    <th className="py-2 pr-2">Partido</th>
                                    <th className="py-2">Predicción</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {j.matches.map((m) => {
                                    const thickBorder = [4, 8, 11, 14].includes(m.match_order);
                                    const state = userState[m.id];
                                    return (
                                      <tr
                                        key={m.id}
                                        className={thickBorder ? "border-b-2 border-slate-300" : "border-b border-slate-100"}
                                      >
                                        <td className="py-2 pr-2 text-slate-500">{m.match_order}</td>
                                        <td className="py-2 pr-2 font-medium text-slate-800">
                                          {m.home_team} – {m.away_team}
                                        </td>
                                        <td className="py-2 text-left">
                                          {m.match_order <= 14 ? (
                                            <div className="flex gap-2">
                                              {OPTIONS_1X2.map((opt) => {
                                                const selected = state?.predicted_1x2 === opt;
                                                return (
                                                  <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() =>
                                                      setPrediction1x2(j.id, user.id, m.id, selected ? null : opt)
                                                    }
                                                    className={`rounded px-2 py-1 text-sm ${
                                                      selected
                                                        ? "bg-slate-800 text-white"
                                                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                                    }`}
                                                  >
                                                    {opt}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          ) : (
                                            <div className="flex flex-col gap-1.5">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-slate-500">Local:</span>
                                                {OPTIONS_PLENO.map((opt) => {
                                                  const sel = state?.predicted_home === opt;
                                                  return (
                                                    <button
                                                      key={opt}
                                                      type="button"
                                                      onClick={() =>
                                                        setPredictionPlenoHome(j.id, user.id, m.id, sel ? null : opt)
                                                      }
                                                      className={`rounded px-2 py-1 text-xs ${
                                                        sel
                                                          ? "bg-slate-800 text-white"
                                                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                                      }`}
                                                    >
                                                      {opt}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-slate-500">Visitante:</span>
                                                {OPTIONS_PLENO.map((opt) => {
                                                  const sel = state?.predicted_away === opt;
                                                  return (
                                                    <button
                                                      key={opt}
                                                      type="button"
                                                      onClick={() =>
                                                        setPredictionPlenoAway(j.id, user.id, m.id, sel ? null : opt)
                                                      }
                                                      className={`rounded px-2 py-1 text-xs ${
                                                        sel
                                                          ? "bg-slate-800 text-white"
                                                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                                      }`}
                                                    >
                                                      {opt}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {/* Mobile: cards */}
                            <div className="md:hidden space-y-3">
                              {j.matches.map((m) => {
                                const thickBorder = [4, 8, 11, 14].includes(m.match_order);
                                const state = userState[m.id];
                                return (
                                  <div
                                    key={m.id}
                                    className={`rounded-lg border p-3 ${
                                      thickBorder ? "border-slate-300 border-2" : "border-slate-200"
                                    } bg-slate-50`}
                                  >
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="text-xs font-medium text-slate-500">#{m.match_order}</span>
                                    </div>
                                    <div className="mb-3 text-sm font-medium text-slate-800">
                                      {m.home_team} – {m.away_team}
                                    </div>
                                    {m.match_order <= 14 ? (
                                      <div className="flex gap-2">
                                        {OPTIONS_1X2.map((opt) => {
                                          const selected = state?.predicted_1x2 === opt;
                                          return (
                                            <button
                                              key={opt}
                                              type="button"
                                              onClick={() =>
                                                setPrediction1x2(j.id, user.id, m.id, selected ? null : opt)
                                              }
                                              className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
                                                selected ? "bg-slate-800 text-white" : "bg-white text-slate-700"
                                              }`}
                                            >
                                              {opt}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <div>
                                          <div className="mb-1 text-xs text-slate-500">Local</div>
                                          <div className="grid grid-cols-4 gap-2">
                                            {OPTIONS_PLENO.map((opt) => {
                                              const sel = state?.predicted_home === opt;
                                              return (
                                                <button
                                                  key={opt}
                                                  type="button"
                                                  onClick={() =>
                                                    setPredictionPlenoHome(j.id, user.id, m.id, sel ? null : opt)
                                                  }
                                                  className={`rounded px-2 py-2 text-sm font-medium ${
                                                    sel ? "bg-slate-800 text-white" : "bg-white text-slate-700"
                                                  }`}
                                                >
                                                  {opt}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="mb-1 text-xs text-slate-500">Visitante</div>
                                          <div className="grid grid-cols-4 gap-2">
                                            {OPTIONS_PLENO.map((opt) => {
                                              const sel = state?.predicted_away === opt;
                                              return (
                                                <button
                                                  key={opt}
                                                  type="button"
                                                  onClick={() =>
                                                    setPredictionPlenoAway(j.id, user.id, m.id, sel ? null : opt)
                                                  }
                                                  className={`rounded px-2 py-2 text-sm font-medium ${
                                                    sel ? "bg-slate-800 text-white" : "bg-white text-slate-700"
                                                  }`}
                                                >
                                                  {opt}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
