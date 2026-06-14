"use client";

import { useEffect, useMemo, useState } from "react";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";
import type { Season } from "@/lib/types";
import type { SeasonFinances, SeasonSummary } from "@/lib/quiniela-season-summary";

type Props = {
  seasons: Season[];
  initialSeasonName: string;
  isAdmin?: boolean;
};

function formatEuro(n: number) {
  return `${n.toFixed(2)} €`;
}

function FinanceCards({ finances }: { finances: SeasonFinances }) {
  const { profit } = finances;
  return (
    <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Coste total</p>
        <p className="mt-1 text-2xl font-bold text-slate-800">{formatEuro(finances.total_cost)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {finances.jornadas_played} jornadas × {formatEuro(finances.cost_per_jornada)}
        </p>
      </div>
      <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-green-700">Ganancias</p>
        <p className="mt-1 text-2xl font-bold text-green-800">{formatEuro(finances.total_prizes)}</p>
        <p className="mt-1 text-xs text-green-700">Premios cobrados en la temporada</p>
      </div>
      <div
        className={`rounded-xl border p-4 shadow-sm sm:col-span-2 lg:col-span-2 ${
          profit >= 0
            ? "border-emerald-200 bg-emerald-50/50"
            : "border-red-200 bg-red-50/50"
        }`}
      >
        <p
          className={`text-xs font-medium uppercase tracking-wide ${
            profit >= 0 ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {profit >= 0 ? "Beneficio" : "Pérdida"}
        </p>
        <p
          className={`mt-1 text-2xl font-bold ${
            profit >= 0 ? "text-emerald-800" : "text-red-800"
          }`}
        >
          {profit >= 0 ? "+" : ""}
          {formatEuro(profit)}
        </p>
        <p className="mt-1 text-xs text-slate-600">Ganancias − coste total</p>
      </div>
    </div>
  );
}

export default function TemporadasClient({ seasons, initialSeasonName, isAdmin }: Props) {
  const [selectedName, setSelectedName] = useState(initialSeasonName);
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/quiniela/seasons/summary?season=${encodeURIComponent(selectedName)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Error al cargar la temporada.");
          setSummary(null);
        } else {
          setSummary(data as SeasonSummary);
        }
      } catch {
        if (!cancelled) {
          setError("Error de conexión.");
          setSummary(null);
        }
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedName]);

  const historyLatestFirst = useMemo(
    () => [...(summary?.history ?? [])].sort((a, b) => b.jornada_number - a.jornada_number),
    [summary?.history]
  );

  const selectedSeason = seasons.find((s) => s.name === selectedName);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="season-select" className="mb-1 block text-sm font-medium text-slate-700">
            Temporada
          </label>
          <select
            id="season-select"
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
                {s.is_active ? " (activa)" : " (archivada)"}
              </option>
            ))}
          </select>
        </div>
        {selectedSeason && (
          <p className="text-sm text-slate-500">
            {selectedSeason.is_active ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">Activa</span>
            ) : (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">Archivada</span>
            )}
            {selectedSeason.archived_at && (
              <span className="ml-2">
                Archivada el {new Date(selectedSeason.archived_at).toLocaleDateString("es-ES")}
              </span>
            )}
          </p>
        )}
      </div>

      {loading && <p className="text-slate-600">Cargando temporada…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && summary && (
        <>
          <FinanceCards finances={summary.finances} />
          {isAdmin && (
            <p className="mb-6 text-xs text-slate-500">
              El coste por jornada ({formatEuro(summary.finances.cost_per_jornada)}) se puede ajustar en Admin →
              Temporadas.
            </p>
          )}

          <section className="mb-10">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">Ranking</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[320px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">#</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Nombre</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Puntos</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Premios (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {summary.ranking.map((entry, i) => {
                    const euros = summary.prizesByUser[entry.quiniela_name] ?? 0;
                    return (
                      <tr key={entry.user_id || entry.quiniela_name} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{entry.quiniela_name}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {entry.total_points}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-700">
                          {euros > 0 ? formatEuro(euros) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {historyLatestFirst.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-800">Puntos por jornada</h2>
              <p className="mb-3 text-sm text-slate-600">
                💰 = premio cobrado esa jornada. Última jornada arriba.
              </p>
              <div className="overflow-x-auto">
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
                        const jornadaPrizes = summary.prizesPerJornada[h.jornada_id] ?? {};
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
                                  className={`px-3 py-2 text-center text-slate-700 ${
                                    hasCobro ? "bg-green-50 font-medium" : ""
                                  }`}
                                >
                                  {pts ?? "-"}
                                  {hasCobro && (
                                    <span
                                      className="ml-1 text-green-700"
                                      title={`Cobró ${formatEuro(cobro)}`}
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
            </section>
          )}
        </>
      )}
    </div>
  );
}
