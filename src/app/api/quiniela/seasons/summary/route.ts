import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSeasonSummary } from "@/lib/quiniela-season-summary";

/** GET: resumen de una temporada (ranking, historial, premios, finanzas) — requiere login */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");

  if (!season) {
    return NextResponse.json({ error: "Parámetro 'season' requerido." }, { status: 400 });
  }

  try {
    const summary = await getSeasonSummary(season);
    if (!summary) {
      return NextResponse.json({ error: "Temporada no encontrada." }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (err) {
    console.error("Error season summary:", err);
    return NextResponse.json(
      { error: "Error al obtener la temporada: " + String(err) },
      { status: 500 }
    );
  }
}
