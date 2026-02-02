"use client";

import { useState } from "react";
import { OPTIONS_1X2, OPTIONS_PLENO } from "@/lib/quiniela-constants";
import type { Jornada } from "@/lib/types";
import type { QuinielaMatch } from "@/lib/types";
import PrizeManager from "./PrizeManager";

type QMatch = QuinielaMatch & { id: string };

type ResultState = {
  result_1x2?: "1" | "X" | "2";
  result_home?: "0" | "1" | "2" | "M";
  result_away?: "0" | "1" | "2" | "M";
};

type Props = {
  jornada: Jornada;
  matches: QMatch[];
  expanded?: boolean;
  onToggle?: () => void;
};

export default function JornadaRow({ jornada, matches, expanded: expandedProp, onToggle }: Props) {
  const [expandedInternal, setExpandedInternal] = useState(false);
  const expanded = expandedProp !== undefined ? expandedProp : expandedInternal;
  const handleToggle = onToggle || (() => setExpandedInternal(!expandedInternal));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [resultState, setResultState] = useState<Record<string, ResultState>>(() => {
    const init: Record<string, ResultState> = {};
    for (const m of matches) {
      if (m.match_order <= 14 && m.result_1x2 != null) {
        init[m.id] = { result_1x2: m.result_1x2 };
      } else if (m.match_order === 15 && m.result_home != null && m.result_away != null) {
        init[m.id] = { result_home: m.result_home, result_away: m.result_away };
      }
    }
    return init;
  });

  function set1x2(matchId: string, value: "1" | "X" | "2") {
    setResultState((prev) => ({ ...prev, [matchId]: { ...prev[matchId], result_1x2: value } }));
  }
  function setPlenoHome(matchId: string, home: "0" | "1" | "2" | "M") {
    setResultState((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], result_home: home, result_away: prev[matchId]?.result_away },
    }));
  }
  function setPlenoAway(matchId: string, away: "0" | "1" | "2" | "M") {
    setResultState((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], result_home: prev[matchId]?.result_home, result_away: away },
    }));
  }

  async function submitResults() {
    const results = matches
      .map((m) => {
        const s = resultState[m.id];
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
      alert("Selecciona al menos un resultado antes de subir.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/quiniela/results", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al subir resultados.");
      return;
    }
    window.location.reload();
  }

  async function deleteJornada() {
    if (!confirm(`¿Eliminar la jornada ${jornada.number}? Se borrarán todos los partidos y votos de esta jornada.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/quiniela/jornadas/${jornada.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al eliminar la jornada.");
      return;
    }
    window.location.reload();
  }

  const isHistorical = jornada.is_historical ?? false;

  return (
    <div className={`rounded-lg overflow-hidden ${
      isHistorical 
        ? "border-2 border-amber-300 bg-amber-50/30" 
        : "border border-slate-200 bg-white"
    }`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`flex w-full items-center justify-between px-4 py-3 text-left ${
          isHistorical ? "hover:bg-amber-50/50" : "hover:bg-slate-50"
        }`}
      >
        <span className="font-medium text-slate-800">
          Jornada {jornada.number}
          {isHistorical && (
            <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
              Histórica
            </span>
          )}
          {jornada.slip_image_url && (
            <span className="ml-2 text-xs text-slate-500">(con foto)</span>
          )}
        </span>
        <svg
          className={`h-4 w-4 text-slate-500 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className={`border-t p-4 ${
          isHistorical 
            ? "border-amber-200 bg-amber-50/20" 
            : "border-slate-200 bg-slate-50/50"
        }`}>
          {isHistorical && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-100/50 p-3 text-sm text-amber-900">
              <strong>Jornada histórica:</strong> Esta jornada solo contiene puntos históricos subidos desde Excel. No tiene resultados de partidos ni predicciones.
            </div>
          )}
          {jornada.slip_image_url && (
            <img
              src={jornada.slip_image_url}
              alt={`Jornada ${jornada.number}`}
              className="mb-4 max-h-40 rounded border border-slate-200 object-contain"
            />
          )}
          {matches.length === 0 ? (
            <p className="text-sm text-slate-500">Esta jornada no tiene partidos registrados.</p>
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Partido</th>
                <th className="py-2">Resultado</th>
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
                  <td className="py-2 pr-2 text-slate-500">{m.match_order}</td>
                  <td className="py-2 pr-2 font-medium text-slate-800">
                    {m.home_team} – {m.away_team}
                  </td>
                  <td className="py-2 text-left">
                    {isHistorical ? (
                      <span className="text-xs text-slate-400 italic">No editable (jornada histórica)</span>
                    ) : m.match_order <= 14 ? (
                      <div className="flex gap-2">
                        {OPTIONS_1X2.map((opt) => {
                          const selected = resultState[m.id]?.result_1x2 === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => set1x2(m.id, opt)}
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
                            const sel = resultState[m.id]?.result_home === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setPlenoHome(m.id, opt)}
                                className={`rounded px-2 py-1 text-xs ${
                                  sel ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
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
                            const sel = resultState[m.id]?.result_away === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setPlenoAway(m.id, opt)}
                                className={`rounded px-2 py-1 text-xs ${
                                  sel ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
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
          )}
          
          <PrizeManager jornadaId={jornada.id} />
          
          <div className="mt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={deleting}
              onClick={deleteJornada}
              className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Eliminando…" : "Eliminar jornada"}
            </button>
            {!isHistorical && (
              <button
                type="button"
                disabled={saving}
                onClick={submitResults}
                className="rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? "Subiendo…" : "Subir resultados"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
