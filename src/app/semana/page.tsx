import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import SemanaClient from "./SemanaClient";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";
import { isCorrect } from "@/lib/quiniela-scoring";
import type { QuinielaMatch, QuinielaPrediction, User } from "@/lib/types";

/** Índice determinista en [0, length) a partir de un seed (para desempate pleno 15). */
function seededIndex(length: number, seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  return Math.abs(h) % length;
}

export default async function SemanaPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  // Obtener temporada activa
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("name")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  const seasonName = activeSeason?.name ?? "2024-25";

  // Buscar la última jornada de la temporada activa que NO sea histórica (para votar)
  const { data: latestJornada } = await supabase
    .from("jornadas")
    .select("*")
    .eq("season", seasonName)
    .eq("is_historical", false)
    .order("number", { ascending: false })
    .limit(1)
    .single();

  // Si no hay jornada no histórica, buscar la última de la temporada activa (puede ser histórica)
  const { data: anyJornada } = latestJornada ? { data: null } : await supabase
    .from("jornadas")
    .select("*")
    .eq("season", seasonName)
    .order("number", { ascending: false })
    .limit(1)
    .single();

  const jornadaToShow = latestJornada ?? anyJornada;

  if (!jornadaToShow) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-4xl px-4 py-8 max-md:px-3 max-md:py-5">
          <h1 className="mb-6 text-2xl font-bold text-slate-800">Semana</h1>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            No hay jornada. El admin debe crear una jornada desde Admin.
          </p>
        </main>
      </>
    );
  }

  // Si la jornada es histórica, mostrar mensaje en lugar del formulario
  if (jornadaToShow.is_historical) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-4xl px-4 py-8 max-md:px-3 max-md:py-5">
          <h1 className="mb-6 text-2xl font-bold text-slate-800">Semana</h1>
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50/30 p-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-800">
              Jornada {jornadaToShow.number}
              <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
                Histórica
              </span>
            </h2>
            <p className="text-slate-700">
              Esta jornada es histórica y solo contiene puntos históricos subidos desde Excel. No se pueden realizar votaciones para jornadas históricas.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Consulta el ranking para ver los puntos de esta jornada.
            </p>
          </div>
        </main>
      </>
    );
  }

  const { data: matches } = await supabase
    .from("quiniela_matches")
    .select("*")
    .eq("jornada_id", jornadaToShow.id)
    .order("match_order", { ascending: true });

  const { data: users } = await supabase
    .from("users")
    .select("id, email, quiniela_name")
    .not("quiniela_name", "is", null);

  const { data: predictions } = await supabase
    .from("quiniela_predictions")
    .select("*")
    .in(
      "quiniela_match_id",
      (matches ?? []).map((m) => m.id)
    );

  const myPredictions = new Map(
    (predictions ?? [])
      .filter((p) => p.user_id === authUser.id)
      .map((p) => [p.quiniela_match_id, p])
  );

  const matchList = (matches ?? []) as QuinielaMatch[];
  const userList = (users ?? []) as User[];
  const allPredictions = (predictions ?? []) as QuinielaPrediction[];

  // Aciertos partidos 1-14; pleno 15 solo suma si has acertado los 14 anteriores y aciertas el pleno
  const correctCountByUser: Record<string, number> = {};
  const match15 = matchList.find((m) => m.match_order === 15);
  const matches1to14 = matchList.filter((m) => m.match_order <= 14);
  for (const u of userList) {
    let count = 0;
    for (const m of matches1to14) {
      const pred = allPredictions.find(
        (p) => p.user_id === u.id && p.quiniela_match_id === m.id
      );
      if (pred && isCorrect(m, pred)) count++;
    }
    const has14correct = count === 14;
    const pred15 = match15
      ? allPredictions.find(
          (p) => p.user_id === u.id && p.quiniela_match_id === match15.id
        )
      : null;
    const pleno15Correct =
      has14correct &&
      match15?.result_home != null &&
      match15?.result_away != null &&
      pred15?.predicted_home === match15.result_home &&
      pred15?.predicted_away === match15.result_away;
    correctCountByUser[u.id] = count + (pleno15Correct ? 1 : 0);
  }

  // Pleno 15 colectivo: opción con más votos; si empate, aleatorio entre empatadas (determinista)
  let collectivePleno15: { home: "0" | "1" | "2" | "M"; away: "0" | "1" | "2" | "M"; voteCount: number } | null = null;
  if (match15) {
    const preds15 = allPredictions.filter((p) => p.quiniela_match_id === match15.id);
    const votes = new Map<string, number>();
    for (const p of preds15) {
      if (p.predicted_home != null && p.predicted_away != null) {
        const key = `${p.predicted_home}-${p.predicted_away}`;
        votes.set(key, (votes.get(key) ?? 0) + 1);
      }
    }
    if (votes.size > 0) {
      const maxVotes = Math.max(...votes.values());
      const tied = [...votes.entries()].filter(([, n]) => n === maxVotes);
      // Empate: aleatorio entre empatadas (determinista por jornada para que no cambie cada carga)
      const chosen =
        tied.length === 1
          ? tied[0]
          : tied[seededIndex(tied.length, jornadaToShow.id)];
      const [home, away] = chosen[0].split("-") as ["0" | "1" | "2" | "M", "0" | "1" | "2" | "M"];
      collectivePleno15 = { home, away, voteCount: chosen[1] };
    }
  }

  const collectivePleno15Correct =
    match15 && collectivePleno15 &&
    match15.result_home != null && match15.result_away != null &&
    match15.result_home === collectivePleno15.home && match15.result_away === collectivePleno15.away;

  const usersInOrder = QUINIELA_NAMES.map((name) =>
    userList.find((u) => u.quiniela_name === name)
  ).filter(Boolean) as User[];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8 max-md:px-3 max-md:py-5">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 max-md:mb-4">Semana</h1>
        <SemanaClient
          jornada={jornadaToShow}
          matches={matchList}
          myPredictions={myPredictions}
          usersInOrder={usersInOrder}
          allPredictions={allPredictions}
          correctCountByUser={correctCountByUser}
          collectivePleno15={collectivePleno15}
          collectivePleno15Correct={collectivePleno15Correct ?? false}
        />
      </main>
    </>
  );
}
