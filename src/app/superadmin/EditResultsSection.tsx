"use client";

import { useState } from "react";
import { OPTIONS_1X2, OPTIONS_PLENO } from "@/lib/quiniela-constants";
import type { Jornada } from "@/lib/types";
import type { QuinielaMatch } from "@/lib/types";

type QMatch = QuinielaMatch & { id: string };

type ResultState = {
  result_1x2?: "1" | "X" | "2";
  result_home?: "0" | "1" | "2" | "M";
  result_away?: "0" | "1" | "2" | "M";
};

type Props = {
  jornadas: Array<Jornada & { matches: QMatch[] }>;
};

export default function EditResultsSection({ jornadas }: Props) {
  const [expandedJornada, setExpandedJornada] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [resultStates, setResultStates] = useState<Record<string, Record<string, ResultState>>>(() => {
    const init: Record<string, Record<string, ResultState>> = {};
    for (const j of jornadas) {
      init[j.id] = {};
      for (const m of j.matches) {
        if (m.match_order <= 14 && m.result_1x2 != null) {
          init[j.id][m.id] = { result_1x2: m.result_1x2 };
        } else if (m.match_order === 15 && m.result_home != null && m.result_away != null) {
          init[j.id][m.id] = { result_home: m.result_home, result_away: m.result_away };
        }
      }
    }
    return init;
  });

  function set1x2(jornadaId: string, matchId: string, value: "1" | "X" | "2") {
    setResultStates((prev) => ({
      ...prev,
      [jornadaId]: { ...prev[jornadaId], [matchId]: { ...prev[jornadaId]?.[matchId], result_1x2: value } },
    }));
  }

  function setPlenoHome(jornadaId: string, matchId: string, home: "0" | "1" | "2" | "M") {
    setResultStates((prev) => ({
      ...prev,
      [jornadaId]: {
        ...prev[jornadaId],
        [matchId]: {
          ...prev[jornadaId]?.[matchId],
          result_home: home,
          result_away: prev[jornadaId]?.[matchId]?.result_away,
        },
      },
    }));
  }

  function setPlenoAway(jornadaId: string, matchId: string, away: "0" | "1" | "2" | "M") {
    setResultStates((prev) => ({
      ...prev,
      [jornadaId]: {
        ...prev[jornadaId],
        [matchId]: {
          ...prev[jornadaId]?.[matchId],
          result_away: away,
          result_home: prev[jornadaId]?.[matchId]?.result_home,
        },
      },
    }));
  }

  async function submitResults(jornadaId: string, matches: QMatch[]) {
    const jornadaState = resultStates[jornadaId] ?? {};
    const results = matches
      .map((m) => {
        const s = jornadaState[m.id];
        if (m.match_order <= 14) {
          const v = s?.result_1x2 ?? null;
          return v != null ? { quiniela_match_id: m.id, result_1x2: v } : null;
        }
        const h = s?.result_home ?? null;
        const a = s?.result_away ?? null;
        return h != null && a != null
          ? { quiniela_match_id: m.id, result_home: h, result_away: a }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
    if (results.length === 0) {
      alert("Selecciona al menos un resultado antes de guardar.");
      return;
    }
    setSaving(jornadaId);
    const res = await fetch("/api/quiniela/results", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al guardar resultados.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      {jornadas.length === 0 ? (
        <p className="text-sm text-slate-500">No hay jornadas disponibles.</p>
      ) : (
        jornadas.map((j) => {
          const isExpanded = expandedJornada === j.id;
          const isHistorical = j.is_historical ?? false;
          const jornadaState = resultStates[j.id] ?? {};
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
                  className={`h-4 w-4 text-slate-500 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
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
                  {isHistorical && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-100/50 p-3 text-sm text-amber-900 max-md:text-xs">
                      <strong>Jornada histórica:</strong> Esta jornada solo contiene puntos históricos. No tiene resultados de partidos.
                    </div>
                  )}
                  {j.matches.length === 0 ? (
                    <p className="text-sm text-slate-500 max-md:text-xs">Esta jornada no tiene partidos registrados.</p>
                  ) : (
                    <>
                      {/* Desktop: tabla */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-600">
                              <th className="py-2 pr-2">#</th>
                              <th className="py-2 pr-2">Partido</th>
                              <th className="py-2">Resultado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {j.matches.map((m) => {
                              const thickBorder = [4, 8, 11, 14].includes(m.match_order);
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
                                    {isHistorical ? (
                                      <span className="text-xs text-slate-400 italic">No editable</span>
                                    ) : m.match_order <= 14 ? (
                                      <div className="flex gap-2">
                                        {OPTIONS_1X2.map((opt) => {
                                          const selected = jornadaState[m.id]?.result_1x2 === opt;
                                          return (
                                            <button
                                              key={opt}
                                              type="button"
                                              onClick={() => set1x2(j.id, m.id, opt)}
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
                                            const sel = jornadaState[m.id]?.result_home === opt;
                                            return (
                                              <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setPlenoHome(j.id, m.id, opt)}
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
                                            const sel = jornadaState[m.id]?.result_away === opt;
                                            return (
                                              <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setPlenoAway(j.id, m.id, opt)}
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
                          return (
                            <div
                              key={m.id}
                              className={`rounded-lg border p-3 ${
                                thickBorder ? "border-slate-300 border-2" : "border-slate-200"
                              } bg-white`}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-500">#{m.match_order}</span>
                                {isHistorical && (
                                  <span className="text-xs text-slate-400 italic">No editable</span>
                                )}
                              </div>
                              <div className="mb-3 text-sm font-medium text-slate-800">
                                {m.home_team} – {m.away_team}
                              </div>
                              {!isHistorical && (
                                <div>
                                  {m.match_order <= 14 ? (
                                    <div className="flex gap-2">
                                      {OPTIONS_1X2.map((opt) => {
                                        const selected = jornadaState[m.id]?.result_1x2 === opt;
                                        return (
                                          <button
                                            key={opt}
                                            type="button"
                                            onClick={() => set1x2(j.id, m.id, opt)}
                                            className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
                                              selected
                                                ? "bg-slate-800 text-white"
                                                : "bg-slate-200 text-slate-700"
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
                                            const sel = jornadaState[m.id]?.result_home === opt;
                                            return (
                                              <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setPlenoHome(j.id, m.id, opt)}
                                                className={`rounded px-2 py-2 text-sm font-medium ${
                                                  sel
                                                    ? "bg-slate-800 text-white"
                                                    : "bg-slate-200 text-slate-700"
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
                                            const sel = jornadaState[m.id]?.result_away === opt;
                                            return (
                                              <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setPlenoAway(j.id, m.id, opt)}
                                                className={`rounded px-2 py-2 text-sm font-medium ${
                                                  sel
                                                    ? "bg-slate-800 text-white"
                                                    : "bg-slate-200 text-slate-700"
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
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {!isHistorical && (
                        <div className="mt-4 flex justify-end max-md:mt-3">
                          <button
                            type="button"
                            disabled={saving === j.id}
                            onClick={() => submitResults(j.id, j.matches)}
                            className="rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 max-md:px-4 max-md:py-2 max-md:text-xs"
                          >
                            {saving === j.id ? "Guardando…" : "Guardar resultados"}
                          </button>
                        </div>
                      )}
                    </>
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
