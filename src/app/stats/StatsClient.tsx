"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";
import type { RankingEntry, PointsHistoryEntry } from "@/lib/types";

// Xavi = rojo, Laura = morado; resto por orden QUINIELA_NAMES
const CHART_COLORS_BY_NAME: Record<string, string> = {
  Xavi: "#dc2626",
  Laura: "#7c3aed",
  Montse: "#0d9488",
  Lluís: "#0284c7",
  Jordi: "#15803d",
  Neus: "#ca8a04",
  Denci: "#b45309",
  Marià: "#0891b2",
};
function getChartColor(name: string): string {
  return CHART_COLORS_BY_NAME[name] ?? "#64748b";
}

type Props = {
  entries: RankingEntry[];
  history: PointsHistoryEntry[];
  seasonName: string;
  prizesByUser: Record<string, number>;
};

export default function StatsClient({ entries, history, seasonName, prizesByUser }: Props) {
  const bestJornadaByUser = useMemo(() => {
    const best: Record<string, { jornada: number; points: number }> = {};
    for (const h of history) {
      for (const [name, points] of Object.entries(h.points_by_user)) {
        if (!best[name] || points > best[name].points) {
          best[name] = { jornada: h.jornada_number, points };
        }
      }
    }
    return best;
  }, [history]);

  const barDataTotal = useMemo(
    () =>
      entries.map((e) => ({
        name: e.quiniela_name,
        puntos: e.total_points,
        color: getChartColor(e.quiniela_name),
      })),
    [entries]
  );

  const barDataBest = useMemo(
    () =>
      QUINIELA_NAMES.map((name) => {
        const best = bestJornadaByUser[name];
        return {
          name,
          "Mejor jornada (pts)": best?.points ?? 0,
          jornada: best?.jornada ?? 0,
          color: getChartColor(name),
        };
      }),
    [bestJornadaByUser]
  );

  const barDataPrizes = useMemo(
    () =>
      QUINIELA_NAMES.map((name) => ({
        name,
        premios: prizesByUser[name] ?? 0,
        color: getChartColor(name),
      }))
        .filter((d) => d.premios > 0)
        .sort((a, b) => b.premios - a.premios), // De más a menos premios
    [prizesByUser]
  );

  const averageByUser = useMemo(() => {
    const totals: Record<string, { sum: number; count: number }> = {};
    for (const h of history) {
      for (const [name, points] of Object.entries(h.points_by_user)) {
        if (!totals[name]) totals[name] = { sum: 0, count: 0 };
        totals[name].sum += points;
        totals[name].count += 1;
      }
    }
    const averages: Record<string, number> = {};
    for (const [name, data] of Object.entries(totals)) {
      averages[name] = data.count > 0 ? data.sum / data.count : 0;
    }
    return averages;
  }, [history]);

  // Regularidad: desviación típica (menor = más regular)
  const regularityByUser = useMemo(() => {
    const byUser: Record<string, number[]> = {};
    for (const h of history) {
      for (const [name, points] of Object.entries(h.points_by_user)) {
        if (!byUser[name]) byUser[name] = [];
        byUser[name].push(points);
      }
    }
    const result: Record<string, number> = {};
    for (const [name, pts] of Object.entries(byUser)) {
      if (pts.length < 2) {
        result[name] = 0;
        continue;
      }
      const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
      const variance = pts.reduce((s, p) => s + (p - avg) ** 2, 0) / pts.length;
      result[name] = Math.sqrt(variance);
    }
    return result;
  }, [history]);

  const mostRegular = useMemo(() => {
    const withData = QUINIELA_NAMES.filter((n) => (regularityByUser[n] ?? 999) < 999 && (averageByUser[n] ?? 0) > 0)
      .map((name) => ({ name, std: regularityByUser[name] ?? 0, avg: averageByUser[name] ?? 0 }))
      .sort((a, b) => a.std - b.std);
    return withData[0]?.name ?? null;
  }, [regularityByUser, averageByUser]);

  const scoreGe10Count = useMemo(() => {
    let count = 0;
    for (const h of history) {
      for (const points of Object.values(h.points_by_user)) {
        if (points >= 10) count += 1;
      }
    }
    return count;
  }, [history]);

  const top3 = entries.slice(0, 3);
  const jornadasCount = history.length;

  return (
    <div className="space-y-10 max-md:space-y-6">
      {/* Hero + KPIs */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-teal-900 px-6 py-8 text-white shadow-xl max-md:px-4 max-md:py-6">
        <div className="relative z-10">
          <h2 className="text-lg font-medium text-slate-300 max-md:text-base">Temporada</h2>
          <h1 className="mt-1 text-3xl font-bold tracking-tight max-md:text-2xl">{seasonName}</h1>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 max-md:mt-4 max-md:gap-3">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm max-md:p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Líder</div>
              <div className="mt-1 text-xl font-bold max-md:text-lg">
                {top3[0]?.quiniela_name ?? "—"}
              </div>
              <div className="text-sm text-slate-300">{top3[0]?.total_points ?? 0} pts</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm max-md:p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Jornadas</div>
              <div className="mt-1 text-2xl font-bold max-md:text-xl">{jornadasCount}</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm max-md:p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Score ≥10</div>
              <div className="mt-1 text-2xl font-bold max-md:text-xl">{scoreGe10Count}</div>
              <div className="text-sm text-slate-300">veces</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm max-md:p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Más regular</div>
              <div className="mt-1 text-lg font-bold max-md:text-base">{mostRegular ?? "—"}</div>
            </div>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
      </div>

      {/* Podium */}
      {top3.length >= 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-md:p-4">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-800 max-md:mb-4 max-md:text-lg">
            <span className="text-2xl max-md:text-xl">🏆</span> Podio
          </h2>
          <div className="flex items-end justify-center gap-2 sm:gap-4 max-md:gap-1">
            {/* 2º */}
            {top3[1] && (
              <div className="flex flex-1 flex-col items-center">
                <div className="text-sm font-bold text-slate-500">2º</div>
                <div className="mt-1 h-16 w-full max-w-[100px] rounded-t-xl bg-gradient-to-t from-slate-300 to-slate-200 flex items-center justify-center">
                  <span className="text-center text-sm font-bold text-slate-700">
                    {top3[1].quiniela_name}
                  </span>
                </div>
                <div className="mt-2 text-lg font-bold text-slate-800">{top3[1].total_points}</div>
              </div>
            )}
            {/* 1º */}
            {top3[0] && (
              <div className="flex flex-1 flex-col items-center">
                <div className="text-lg font-bold text-amber-600">1º</div>
                <div className="mt-1 h-24 w-full max-w-[120px] rounded-t-xl bg-gradient-to-t from-amber-400 to-amber-300 flex items-center justify-center shadow-md">
                  <span className="text-center text-sm font-bold text-amber-900">
                    {top3[0].quiniela_name}
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold text-slate-800">{top3[0].total_points}</div>
              </div>
            )}
            {/* 3º */}
            {top3[2] && (
              <div className="flex flex-1 flex-col items-center">
                <div className="text-sm font-bold text-slate-600">3º</div>
                <div className="mt-1 h-12 w-full max-w-[100px] rounded-t-xl bg-gradient-to-t from-amber-700/30 to-amber-800/20 flex items-center justify-center">
                  <span className="text-center text-sm font-bold text-slate-700">
                    {top3[2].quiniela_name}
                  </span>
                </div>
                <div className="mt-2 text-lg font-bold text-slate-800">{top3[2].total_points}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ranking completo */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-md:p-4">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800 max-md:mb-3 max-md:text-lg">
          <span>🏁</span> Ranking completo
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 max-md:grid-cols-1">
          {entries.map((entry, i) => {
            const prize = prizesByUser[entry.quiniela_name] ?? 0;
            return (
              <div
                key={entry.user_id || entry.quiniela_name}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                      i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-700" : "bg-slate-600"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-800">{entry.quiniela_name}</span>
                    {prize > 0 && (
                      <span className="text-xs font-semibold text-green-700">💰 {prize.toFixed(2)} €</span>
                    )}
                  </div>
                </div>
                <span className="font-bold text-slate-800">{entry.total_points}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Por usuario */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-slate-800">
          <span>👤</span> Por usuario
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          σ = desviación típica: cuánto varían tus puntos jornada a jornada. Menor = más regular.
        </p>
        <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-md:gap-3">
          {QUINIELA_NAMES.map((name) => {
            const best = bestJornadaByUser[name];
            const avg = averageByUser[name] ?? 0;
            const std = regularityByUser[name] ?? 0;
            const color = getChartColor(name);
            return (
              <div
                key={name}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-md"
                style={{ borderLeftWidth: "4px", borderLeftColor: color }}
              >
                <div className="text-sm font-bold text-slate-800">{name}</div>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <div>Mejor: {best ? `${best.points} pts (J${best.jornada})` : "—"}</div>
                  <div>Promedio: {avg > 0 ? avg.toFixed(1) : "—"} pts</div>
                  {std > 0 && <div className="text-slate-500">σ ≈ {std.toFixed(1)}</div>}
                  {(prizesByUser[name] ?? 0) > 0 && (
                    <div className="mt-1 font-semibold text-green-700">
                      💰 {(prizesByUser[name] ?? 0).toFixed(2)} €
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Puntos totales y mejor jornada */}
      <div className="grid gap-6 lg:grid-cols-2 max-md:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-md:p-4">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800 max-md:mb-3 max-md:text-base">
            <span>📊</span> Puntos totales
          </h2>
          {barDataTotal.length > 0 ? (
            <div className="h-64 w-full max-md:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barDataTotal} layout="vertical" margin={{ left: 50, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px" }} />
                  <Bar dataKey="puntos" name="Puntos" radius={[0, 6, 6, 0]}>
                    {barDataTotal.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin datos.</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-md:p-4">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800 max-md:mb-3 max-md:text-base">
            <span>🎯</span> Mejor jornada (puntos)
          </h2>
          {barDataBest.some((d) => d["Mejor jornada (pts)"] > 0) ? (
            <div className="h-64 w-full max-md:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barDataBest} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, _name, props) =>
                      [value ?? 0, `Jornada ${(props?.payload as { jornada?: number })?.jornada ?? "-"}`]
                    }
                    contentStyle={{ borderRadius: "12px" }}
                  />
                  <Bar dataKey="Mejor jornada (pts)" name="Puntos" radius={[6, 6, 0, 0]}>
                    {barDataBest.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin datos.</p>
          )}
        </div>
      </div>

      {/* Premios ganados */}
      {barDataPrizes.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-white p-6 shadow-lg max-md:p-4">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800 max-md:mb-3 max-md:text-lg">
            <span>💰</span> Premios ganados
          </h2>
          <div className="h-80 w-full max-md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barDataPrizes} layout="vertical" margin={{ left: 50, right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 11 }} 
                  tickFormatter={(value) => `${value.toFixed(2)} €`}
                />
                <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value) => [`${Number(value).toFixed(2)} €`, "Premios"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="premios" name="Premios" radius={[0, 8, 8, 0]} barSize={28}>
                  <LabelList
                    dataKey="premios"
                    position="insideEnd"
                    formatter={(value: number) => `${value.toFixed(2)} €`}
                    style={{ fill: "#fff", fontWeight: 700, fontSize: 13 }}
                  />
                  {barDataPrizes.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
