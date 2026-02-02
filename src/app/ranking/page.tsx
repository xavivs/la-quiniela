import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { getSeasonRanking, getPointsHistory } from "@/lib/quiniela-ranking";
import { getPrizesBySeason, getPrizesPerJornada } from "@/lib/quiniela-prizes";
import RankingClient from "./RankingClient";

export default async function RankingPage() {
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
  const prizesPerJornada = await getPrizesPerJornada(currentSeasonName);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 max-md:px-3 max-md:py-5">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Ranking</h1>
        <RankingClient
          entries={entries}
          prizesByUser={prizesByUser}
          currentSeasonName={currentSeasonName}
          history={history}
          prizesPerJornada={prizesPerJornada}
        />
      </main>
    </>
  );
}
