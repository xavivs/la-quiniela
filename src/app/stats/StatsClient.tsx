"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
const CHART_COLORS_ARRAY = ["Xavi", "Laura", "Montse", "Lluís", "Jordi", "Neus", "Denci", "Marià"].map(
  (n) => CHART_COLORS_BY_NAME[n] ?? "#64748b"
);

type Props = {
  entries: RankingEntry[];
  history: PointsHistoryEntry[];
  seasonName: string;
};

export default function StatsClient({ entries, history, seasonName }: Props) {
  const [chartUsers, setChartUsers] = useState<Set<string>>(() => new Set(QUINIELA_NAMES));

  const toggleChartUser = (name: string) => {
    setChartUsers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Evolución: puntos acumulados
  const evolutionData = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.jornada_number - b.jornada_number);
    const cumulative: Record<string, number> = {};
    const result: { jornada: number; [key: string]: number }[] = [];
    for (const h of sorted) {
      const row: { jornada: number; [key: string]: number } = { jornada: h.jornada_number };
      for (const [name, pts] of Object.entries(h.points_by_user)) {
        cumulative[name] = (cumulative[name] ?? 0) + pts;
        row[name] = cumulative[name];
      }
      for (const name of QUINIELA_NAMES) {
        if (row[name] == null) row[name] = cumulative[name] ?? 0;
      }
      result.push(row);
    }
    return result;
  }, [history]);

  // Puntos por jornada (no acumulados), escala 0–15
  const perJornadaData = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.jornada_number - b.jornada_number);
    return sorted.map((h) => {
      const row: { jornada: number; [key: string]: number } = { jornada: h.jornada_number };
      for (const name of QUINIELA_NAMES) {
        row[name] = h.points_by_user[name] ?? 0;
      }
      return row;
    });
  }, [history]);

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

  // Jornada récord: jornada con más puntos totales sumando todos
  const recordJornada = useMemo(() => {
    if (history.length === 0) return null;
    let best = { jornada: 0, total: 0 };
    for (const h of history) {
      const total = Object.values(h.points_by_user).reduce((a, b) => a + b, 0);
      if (total > best.total) best = { jornada: h.jornada_number, total };
    }
    return best;
  }, [history]);

  // Score >= 10 en una jornada
  const scoreGe10 = useMemo(() => {
    const list: Array<{ jornada: number; user: string; points: number }> = [];
    for (const h of history) {
      for (const [name, points] of Object.entries(h.points_by_user)) {
        if (points >= 10) list.push({ jornada: h.jornada_number, user: name, points });
      }
    }
    return list.sort((a, b) => b.points - a.points);
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
              <div className="mt-1 text-2xl font-bold max-md:text-xl">{scoreGe10.length}</div>
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

      {/* Jornada récord + Score ≥10 en una fila */}
      <div className="grid gap-6 md:grid-cols-2">
        {recordJornada && (
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-md max-md:p-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 max-md:text-base">
              <span>📈</span> Jornada récord
            </h3>
            <p className="mt-2 text-3xl font-bold text-emerald-700 max-md:text-2xl">
              Jornada {recordJornada.jornada}
            </p>
            <p className="text-slate-600">
              {recordJornada.total} puntos totales entre todos
            </p>
          </div>
        )}
        {scoreGe10.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-md">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <span>⭐</span> Score ≥10
            </h3>
            <div className="mt-3 space-y-2">
              {scoreGe10.slice(0, 8).map((w, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-white/80 py-2 px-3"
                >
                  <span className="font-medium text-slate-800">{w.user}</span>
                  <span className="text-sm text-slate-500">
                    Jornada {w.jornada} · {w.points} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gráfico evolutivo */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-md:p-4">
        <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-slate-800 max-md:text-lg">
          <span>📉</span> Evolución de puntos acumulados
        </h2>
        <p className="mb-4 text-sm text-slate-500 max-md:mb-3 max-md:text-xs">
          Activa o desactiva cada usuario para comparar.
        </p>
        <div className="mb-4 flex flex-wrap gap-2 max-md:mb-3">
          {QUINIELA_NAMES.map((name, i) => (
            <label
              key={name}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm transition hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={chartUsers.has(name)}
                onChange={() => toggleChartUser(name)}
                className="rounded border-slate-300"
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getChartColor(name) }}
              />
              <span>{name}</span>
            </label>
          ))}
        </div>
        {evolutionData.length > 0 ? (
          <div className="h-80 w-full max-md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  {CHART_COLORS_ARRAY.map((c, i) => (
                    <linearGradient key={i} id={`fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="jornada" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) => [value ?? 0, name ?? ""]}
                  labelFormatter={(label) => `Jornada ${label}`}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                />
                <Legend />
                {QUINIELA_NAMES.filter((n) => chartUsers.has(n)).map((name, i) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS_ARRAY[QUINIELA_NAMES.indexOf(name)] ?? CHART_COLORS_ARRAY[i]}
                    strokeWidth={2.5}
                    fill={`url(#fill-${QUINIELA_NAMES.indexOf(name)})`}
                    connectNulls
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-slate-500">No hay datos de jornadas.</p>
        )}

        {/* Puntos por jornada (escala 0–15) */}
        {perJornadaData.length > 0 && (
          <>
            <h3 className="mt-8 mb-2 flex items-center gap-2 text-lg font-bold text-slate-800 max-md:mt-6 max-md:text-base">
              Puntos de cada jornada (0–15)
            </h3>
            <div className="h-80 w-full max-md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perJornadaData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    {CHART_COLORS_ARRAY.map((c, i) => (
                      <linearGradient key={i} id={`fillJ-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="jornada" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 15]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => [value ?? 0, name ?? ""]}
                    labelFormatter={(label) => `Jornada ${label}`}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                  />
                  <Legend />
                  {QUINIELA_NAMES.filter((n) => chartUsers.has(n)).map((name) => {
                    const idx = QUINIELA_NAMES.indexOf(name);
                    return (
                      <Area
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={CHART_COLORS_ARRAY[idx] ?? "#64748b"}
                        strokeWidth={2}
                        fill={`url(#fillJ-${idx})`}
                        connectNulls
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Dos gráficos de barras en fila */}
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

      {/* Tarjetas: mejor jornada + promedio + regularidad (2 filas de 4) */}
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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ranking completo compacto */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-md:p-4">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800 max-md:mb-3 max-md:text-lg">
          <span>🏁</span> Ranking completo
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 max-md:grid-cols-1">
          {entries.map((entry, i) => (
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
                <span className="font-medium text-slate-800">{entry.quiniela_name}</span>
              </div>
              <span className="font-bold text-slate-800">{entry.total_points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
