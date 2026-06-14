"use client";

import { useState, useMemo } from "react";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";
import type { RankingEntry } from "@/lib/types";

type Props = {
  entries: RankingEntry[];
  prizesByUser: Record<string, number>;
  currentSeasonName: string;
  history: { jornada_id: string; jornada_number: number; points_by_user: Record<string, number> }[];
  prizesPerJornada: Record<string, Record<string, number>>;
};

function computePositions<T>(
  items: T[],
  getValue: (item: T) => number,
  getKey: (item: T) => string
): Record<string, number> {
  const sorted = [...items].sort((a, b) => getValue(b) - getValue(a));
  const rankByKey: Record<string, number> = {};
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && getValue(sorted[i]) < getValue(sorted[i - 1])) rank = i + 1;
    rankByKey[getKey(sorted[i])] = rank;
  }
  return rankByKey;
}

export default function RankingClient({
  entries,
  prizesByUser,
  currentSeasonName,
  history,
  prizesPerJornada,
}: Props) {
  const [viewMode, setViewMode] = useState<"points" | "euros">("points");

  const entriesWithPrizes = useMemo(
    () =>
      entries.map((e) => ({
        ...e,
        total_prizes: prizesByUser[e.quiniela_name] ?? 0,
      })),
    [entries, prizesByUser]
  );

  const sortedByPoints = useMemo(
    () =>
      [...entriesWithPrizes].sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points;
        return (a.quiniela_name ?? "").localeCompare(b.quiniela_name ?? "");
      }),
    [entriesWithPrizes]
  );

  const sortedByEuros = useMemo(
    () =>
      [...entriesWithPrizes].sort((a, b) => {
        if (b.total_prizes !== a.total_prizes) return b.total_prizes - a.total_prizes;
        if (b.total_points !== a.total_points) return b.total_points - a.total_points;
        return (a.quiniela_name ?? "").localeCompare(b.quiniela_name ?? "");
      }),
    [entriesWithPrizes]
  );

  const displayList = viewMode === "points" ? sortedByPoints : sortedByEuros;
  const historyLatestFirst = useMemo(
    () => [...history].sort((a, b) => b.jornada_number - a.jornada_number),
    [history]
  );
  const rankByKey = useMemo(
    () =>
      viewMode === "points"
        ? computePositions(displayList, (e) => e.total_points, (e) => e.quiniela_name)
        : computePositions(displayList, (e) => e.total_prizes, (e) => e.quiniela_name),
    [viewMode, displayList]
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
        <p className="text-slate-600 max-md:text-sm">
          Temporada <strong>{currentSeasonName}</strong>. En Premios (€) el orden es por dinero cobrado.
        </p>
        <div className="flex items-center gap-2 max-md:justify-end">
          <span className="text-sm text-slate-600 max-md:sr-only">Ver:</span>
          <button
            onClick={() => setViewMode("points")}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors max-md:min-h-[44px] max-md:flex-1 ${
              viewMode === "points"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Puntos
          </button>
          <button
            onClick={() => setViewMode("euros")}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors max-md:min-h-[44px] max-md:flex-1 ${
              viewMode === "euros"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Premios (€)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200 bg-white shadow-sm max-md:-mx-3 max-md:mx-0 max-md:rounded-none max-md:border-x-0">
        <table className="w-full min-w-[280px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">#</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Nombre</th>
              {viewMode === "points" ? (
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Puntos</th>
              ) : (
                <>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                    Premios (€)
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                    Puntos
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {displayList.map((entry) => {
              const pos = rankByKey[entry.quiniela_name] ?? 0;
              const hasPrize = entry.total_prizes > 0;
              return (
                <tr key={entry.user_id || entry.quiniela_name} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{pos}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <span className="max-md:block">{entry.quiniela_name}</span>
                    {viewMode === "euros" && hasPrize && (
                      <span className="ml-2 whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 max-md:ml-0 max-md:mt-1 max-md:inline-block">
                        💰 Ha cobrado
                      </span>
                    )}
                  </td>
                  {viewMode === "points" ? (
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {entry.total_points}
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right font-medium text-green-700">
                        {entry.total_prizes > 0 ? `${entry.total_prizes.toFixed(2)} €` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">
                        {entry.total_points} pts
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {history.length > 0 && (
        <div className="mt-10 max-md:mt-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-800 max-md:text-lg">
            Historial de puntos por jornada
          </h2>
          <p className="mb-2 text-sm text-slate-600 max-md:text-xs">
            Si alguien cobró premio en una jornada, se indica con 💰 en esa celda. Última jornada arriba.
          </p>
          <div className="overflow-x-auto max-md:-mx-3 max-md:px-3">
            <div className="inline-block min-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Jornada</th>
                    {QUINIELA_NAMES.map((name) => (
                      <th key={name} className="px-3 py-2 text-center font-medium text-slate-700">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {historyLatestFirst.map((h) => {
                    const jornadaPrizes = prizesPerJornada[h.jornada_id] ?? {};
                    return (
                      <tr key={h.jornada_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">
                          Jornada {h.jornada_number}
                        </td>
                        {QUINIELA_NAMES.map((name) => {
                          const pts = h.points_by_user[name];
                          const cobro = jornadaPrizes[name];
                          const hasCobro = cobro != null && cobro > 0;
                          return (
                            <td
                              key={name}
                              className={`px-3 py-2 text-center text-slate-700 ${hasCobro ? "bg-green-50 font-medium" : ""}`}
                            >
                              <span className="max-md:block">{pts ?? "-"}</span>
                              {hasCobro && (
                                <span
                                  className="ml-1 text-green-700 max-md:ml-0 max-md:mt-0.5 max-md:block"
                                  title={`Cobró ${cobro.toFixed(2)} €`}
                                >
                                  💰
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
