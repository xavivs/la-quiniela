import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSeasonRankingBySeason } from "@/lib/quiniela-ranking";

/** GET: obtener ranking de una temporada específica */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");

  if (!season) {
    return NextResponse.json({ error: "Parámetro 'season' requerido." }, { status: 400 });
  }

  try {
    const ranking = await getSeasonRankingBySeason(season);
    return NextResponse.json({ ranking });
  } catch (err) {
    console.error("Error getting ranking:", err);
    return NextResponse.json(
      { error: "Error al obtener el ranking: " + String(err) },
      { status: 500 }
    );
  }
}
