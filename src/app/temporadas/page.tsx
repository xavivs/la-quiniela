import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { listSeasons } from "@/lib/quiniela-season-summary";
import TemporadasClient from "./TemporadasClient";

export const dynamic = "force-dynamic";

export default async function TemporadasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dbUser } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";

  const seasons = await listSeasons();
  const active = seasons.find((s) => s.is_active);
  const initialSeasonName = active?.name ?? seasons[0]?.name ?? "";

  if (!initialSeasonName) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="mb-2 text-2xl font-bold text-slate-800">Temporadas</h1>
          <p className="text-slate-600">No hay temporadas registradas.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 max-md:px-3 max-md:py-5">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Temporadas</h1>
        <p className="mb-6 text-slate-600 max-md:text-sm">
          Consulta el ranking, los puntos por jornada y el balance de cada temporada.
        </p>
        <TemporadasClient
          seasons={seasons}
          initialSeasonName={initialSeasonName}
          isAdmin={role === "admin" || role === "superadmin"}
        />
      </main>
    </>
  );
}
