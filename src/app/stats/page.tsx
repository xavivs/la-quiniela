import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { getSeasonRanking, getPointsHistory } from "@/lib/quiniela-ranking";
import { getPrizesBySeason } from "@/lib/quiniela-prizes";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";
import StatsClient from "./StatsClient";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Obtener temporada activa
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("name")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const currentSeasonName = activeSeason?.name ?? "2024-25";

  const entries = await getSeasonRanking();
  const history = await getPointsHistory();
  const prizesByUser = await getPrizesBySeason(currentSeasonName);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 max-md:px-3 max-md:py-5">
        <div className="mb-8 max-md:mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 max-md:text-2xl">
            Estadísticas
          </h1>
          <p className="mt-1 text-slate-600 max-md:text-sm">
            Evolución, podio, récords y comparativas de la temporada.
          </p>
        </div>
        <StatsClient entries={entries} history={history} seasonName={currentSeasonName} prizesByUser={prizesByUser} />
      </main>
    </>
  );
}
