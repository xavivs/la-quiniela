import { createClient } from "@/lib/supabase/server";
import ImportJornadaForm from "./ImportJornadaForm";
import JornadasList from "./JornadasList";
import FetchResultsFromWeb from "./FetchResultsFromWeb";
import UploadPointsHistory from "./UploadPointsHistory";

export default async function CurrentSeasonTab() {
  const supabase = await createClient();

  // Obtener temporada activa
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("name")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const currentSeasonName = activeSeason?.name ?? "2024-25";

  // Obtener jornadas de la temporada activa
  const { data: jornadas } = await supabase
    .from("jornadas")
    .select("*")
    .eq("season", currentSeasonName)
    .order("number", { ascending: false });

  // Obtener matches para cada jornada
  const jornadasWithMatches = await Promise.all(
    (jornadas ?? []).map(async (j) => {
      const { data: matches } = await supabase
        .from("quiniela_matches")
        .select("*")
        .eq("jornada_id", j.id)
        .order("match_order", { ascending: true });
      return { ...j, matches: matches ?? [] };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          Temporada actual: {currentSeasonName}
        </h2>
        <p className="mb-6 text-slate-600">
          Crea jornadas (solo equipos) y luego actualiza los resultados desde la web o manualmente.
        </p>
      </div>

      <ImportJornadaForm />

      <UploadPointsHistory />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          Actualizar resultados de la jornada
        </h2>
        <FetchResultsFromWeb />
        <div className="mt-6">
          <h3 className="mb-3 text-base font-medium text-slate-800">
            Jornadas - Temporada {currentSeasonName}
            {jornadas?.some((j) => j.is_historical) &&
              " (las marcadas como históricas solo tienen puntos, sin resultados)"}
          </h3>
          <JornadasList jornadas={jornadasWithMatches} />
        </div>
      </div>
    </div>
  );
}
