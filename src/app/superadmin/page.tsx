import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import SuperadminClient from "./SuperadminClient";
import type { User } from "@/lib/types";
import type { Jornada } from "@/lib/types";
import type { QuinielaMatch, QuinielaPrediction } from "@/lib/types";

type QMatch = QuinielaMatch & { id: string };
type QPrediction = QuinielaPrediction & { id: string };

export default async function SuperadminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dbUser } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";
  if (role !== "superadmin") redirect("/semana");

  const { data: users } = await supabase
    .from("users")
    .select("id, email, quiniela_name, role")
    .not("quiniela_name", "is", null)
    .order("quiniela_name");

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
      return { ...j, matches: (matches ?? []) as QMatch[] };
    })
  );

  // Obtener todas las predicciones de la temporada activa
  const jornadaIds = (jornadas ?? []).map((j) => j.id);
  const matchIds = jornadasWithMatches.flatMap((j) => j.matches.map((m) => m.id));
  const { data: predictions } = await supabase
    .from("quiniela_predictions")
    .select("*")
    .in("quiniela_match_id", matchIds.length > 0 ? matchIds : ["00000000-0000-0000-0000-000000000000"]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 max-md:px-3 max-md:py-5">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 max-md:text-xl">Superadmin</h1>
        <SuperadminClient
          users={(users ?? []) as User[]}
          jornadas={jornadasWithMatches as Array<Jornada & { matches: QMatch[] }>}
          predictions={(predictions ?? []) as QPrediction[]}
        />
      </main>
    </>
  );
}
