"use client";

import { useState, useEffect } from "react";
import type { Season } from "@/lib/types";
import CreateSeasonForm from "./CreateSeasonForm";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";

export default function ManageSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedSeasonForRanking, setSelectedSeasonForRanking] = useState<string | null>(null);
  const [jornadasCount, setJornadasCount] = useState<Record<string, number>>({});
  const [activeSeasonName, setActiveSeasonName] = useState<string | null>(null);
  
  // Función para manejar el toggle de ranking/jornadas asegurando que solo uno esté abierto
  function handleToggleRanking(seasonName: string) {
    if (selectedSeasonForRanking === seasonName) {
      setSelectedSeasonForRanking(null);
    } else {
      setSelectedSeasonForRanking(seasonName);
      setSelectedSeason(null); // Cerrar jornadas si está abierto
    }
  }
  
  function handleToggleJornadas(seasonName: string) {
    if (selectedSeason === seasonName) {
      setSelectedSeason(null);
    } else {
      setSelectedSeason(seasonName);
      setSelectedSeasonForRanking(null); // Cerrar ranking si está abierto
    }
  }

  useEffect(() => {
    loadSeasons();
  }, []);

  async function loadSeasons() {
    setLoading(true);
    try {
      const res = await fetch("/api/quiniela/seasons");
      const data = await res.json();
      if (res.ok) {
        const seasonsList = data.seasons ?? [];
        setSeasons(seasonsList);
        // Guardar nombre de temporada activa
        const active = seasonsList.find((s: Season) => s.is_active);
        setActiveSeasonName(active?.name ?? null);
        // Cargar conteo de jornadas para cada temporada
        loadJornadasCount(seasonsList);
      } else {
        setMessage({ type: "error", text: data.error ?? "Error al cargar temporadas." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error de conexión: " + String(err) });
    }
    setLoading(false);
  }

  async function loadJornadasCount(seasonsList: Season[]) {
    const counts: Record<string, number> = {};
    for (const season of seasonsList) {
      try {
        const res = await fetch(`/api/quiniela/jornadas?season=${encodeURIComponent(season.name)}`);
        const data = await res.json();
        counts[season.name] = data.jornadas?.length ?? 0;
      } catch {
        counts[season.name] = 0;
      }
    }
    setJornadasCount(counts);
  }

  async function handleDeleteSeason(seasonId: string, seasonName: string) {
    if (!confirm(`¿Estás seguro de eliminar la temporada "${seasonName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/quiniela/seasons/${seasonId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Temporada "${seasonName}" eliminada correctamente.` });
        loadSeasons();
        setSelectedSeason(null);
      } else {
        setMessage({ type: "error", text: data.error ?? "Error al eliminar la temporada." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error de conexión: " + String(err) });
    }
  }


  if (loading) {
    return <p className="text-slate-600">Cargando temporadas...</p>;
  }

  const activeSeason = seasons.find((s) => s.is_active);
  const archivedSeasons = seasons.filter((s) => !s.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Crear nueva temporada</h2>
        <CreateSeasonForm
          onSeasonCreated={() => {
            loadSeasons();
            setMessage({ type: "success", text: "Temporada creada correctamente." });
          }}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Temporadas</h2>
        {message && (
          <div
            className={`mb-4 rounded-lg p-3 ${
              message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {seasons.length === 0 ? (
          <p className="text-slate-500">No hay temporadas creadas.</p>
        ) : (
          <div className="space-y-4">
            {/* Temporada activa */}
            {activeSeason && (
              <div className="rounded-lg border-2 border-green-200 bg-green-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-800">{activeSeason.name}</h3>
                      <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                        Activa
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Creada: {new Date(activeSeason.created_at ?? "").toLocaleDateString("es-ES")}
                    </p>
                    <p className="text-sm text-slate-600">
                      Jornadas: {jornadasCount[activeSeason.name] ?? 0}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleRanking(activeSeason.name)}
                      className={`rounded px-3 py-1.5 text-sm font-medium ${
                        selectedSeasonForRanking === activeSeason.name
                          ? "bg-green-700 text-white"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      Ver ranking
                    </button>
                    <button
                      onClick={() => handleToggleJornadas(activeSeason.name)}
                      className={`rounded px-3 py-1.5 text-sm font-medium ${
                        selectedSeason === activeSeason.name
                          ? "bg-blue-700 text-white"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      Ver jornadas
                    </button>
                  </div>
                </div>
                
                {/* Contenido desplegado justo debajo */}
                {selectedSeasonForRanking === activeSeason.name && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-base font-semibold text-slate-800">
                        Ranking activo - Temporada {activeSeason.name}
                      </h4>
                      <button
                        onClick={() => setSelectedSeasonForRanking(null)}
                        className="text-sm text-slate-500 hover:text-slate-700"
                      >
                        Cerrar
                      </button>
                    </div>
                    <SeasonRankingList seasonName={activeSeason.name} />
                  </div>
                )}
                
                {selectedSeason === activeSeason.name && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-base font-semibold text-slate-800">
                        Puntos por jornada - Temporada {activeSeason.name}
                      </h4>
                      <button
                        onClick={() => setSelectedSeason(null)}
                        className="text-sm text-slate-500 hover:text-slate-700"
                      >
                        Cerrar
                      </button>
                    </div>
                    <SeasonPointsHistoryList seasonName={activeSeason.name} />
                  </div>
                )}
              </div>
            )}

            {/* Temporadas archivadas */}
            {archivedSeasons.length > 0 && (
              <div>
                <h3 className="mb-3 text-base font-medium text-slate-700">Temporadas archivadas</h3>
                <div className="space-y-3">
                  {archivedSeasons.map((season) => (
                    <div
                      key={season.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-medium text-slate-800">{season.name}</h4>
                            <span className="rounded-full bg-slate-400 px-2 py-0.5 text-xs font-medium text-white">
                              Archivada
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            Creada: {new Date(season.created_at ?? "").toLocaleDateString("es-ES")}
                            {season.archived_at &&
                              ` • Archivada: ${new Date(season.archived_at).toLocaleDateString("es-ES")}`}
                          </p>
                          <p className="text-sm text-slate-600">
                            Jornadas: {jornadasCount[season.name] ?? 0}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleRanking(season.name)}
                            className={`rounded px-3 py-1.5 text-sm font-medium ${
                              selectedSeasonForRanking === season.name
                                ? "bg-green-700 text-white"
                                : "bg-green-600 text-white hover:bg-green-700"
                            }`}
                          >
                            Ver ranking
                          </button>
                          <button
                            onClick={() => handleToggleJornadas(season.name)}
                            className={`rounded px-3 py-1.5 text-sm font-medium ${
                              selectedSeason === season.name
                                ? "bg-blue-700 text-white"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          >
                            Ver jornadas
                          </button>
                          <button
                            onClick={() => handleDeleteSeason(season.id, season.name)}
                            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                      
                      {/* Contenido desplegado justo debajo */}
                      {selectedSeasonForRanking === season.name && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-base font-semibold text-slate-800">
                              Ranking archivado - Temporada {season.name}
                            </h4>
                            <button
                              onClick={() => setSelectedSeasonForRanking(null)}
                              className="text-sm text-slate-500 hover:text-slate-700"
                            >
                              Cerrar
                            </button>
                          </div>
                          <SeasonRankingList seasonName={season.name} />
                        </div>
                      )}
                      
                      {selectedSeason === season.name && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-base font-semibold text-slate-800">
                              Puntos por jornada - Temporada {season.name}
                            </h4>
                            <button
                              onClick={() => setSelectedSeason(null)}
                              className="text-sm text-slate-500 hover:text-slate-700"
                            >
                              Cerrar
                            </button>
                          </div>
                          <SeasonPointsHistoryList seasonName={season.name} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SeasonRankingList({ seasonName }: { seasonName: string }) {
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/quiniela/ranking?season=${encodeURIComponent(seasonName)}`);
        const data = await res.json();
        if (res.ok) {
          setRanking(data.ranking ?? []);
        }
      } catch {
        // Ignorar errores
      }
      setLoading(false);
    }
    load();
  }, [seasonName]);

  if (loading) return <p className="text-slate-600">Cargando ranking...</p>;
  if (ranking.length === 0) return <p className="text-slate-500">No hay datos de ranking para esta temporada.</p>;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">#</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Nombre</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Puntos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {ranking.map((entry, i) => (
            <tr key={entry.user_id || entry.quiniela_name} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-600">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{entry.quiniela_name}</td>
              <td className="px-4 py-3 text-right font-medium text-slate-800">{entry.total_points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeasonPointsHistoryList({ seasonName }: { seasonName: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/quiniela/points-history?season=${encodeURIComponent(seasonName)}`);
        const data = await res.json();
        if (res.ok) {
          setHistory(data.history ?? []);
        }
      } catch {
        // Ignorar errores
      }
      setLoading(false);
    }
    load();
  }, [seasonName]);

  if (loading) return <p className="text-slate-600">Cargando puntos por jornada...</p>;
  if (history.length === 0)
    return <p className="text-slate-500">No hay datos de puntos por jornada para esta temporada.</p>;

  return (
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
            {history.map((h) => (
              <tr key={h.jornada_id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">Jornada {h.jornada_number}</td>
                {QUINIELA_NAMES.map((name) => (
                  <td key={name} className="px-3 py-2 text-center text-slate-700">
                    {h.points_by_user[name] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
