import { NextResponse } from "next/server";
import { getSeasonRankingBySeason } from "@/lib/quiniela-ranking";
import { getPrizesBySeason } from "@/lib/quiniela-prizes";

/** GET: ranking de una temporada (+ premios totales por usuario) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");

  if (!season) {
    return NextResponse.json({ error: "Parámetro 'season' requerido." }, { status: 400 });
  }

  try {
    const [ranking, prizesByUser] = await Promise.all([
      getSeasonRankingBySeason(season),
      getPrizesBySeason(season),
    ]);
    return NextResponse.json({ ranking, prizesByUser });
  } catch (err) {
    console.error("Error getting ranking:", err);
    return NextResponse.json(
      { error: "Error al obtener el ranking: " + String(err) },
      { status: 500 }
    );
  }
}
