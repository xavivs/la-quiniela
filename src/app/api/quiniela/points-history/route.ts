import { NextResponse } from "next/server";
import { getPointsHistoryBySeason } from "@/lib/quiniela-ranking";

/** GET: obtener historial de puntos por jornada de una temporada específica */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");

  if (!season) {
    return NextResponse.json({ error: "Parámetro 'season' requerido." }, { status: 400 });
  }

  try {
    const history = await getPointsHistoryBySeason(season);
    return NextResponse.json({ history });
  } catch (err) {
    console.error("Error getting points history:", err);
    return NextResponse.json(
      { error: "Error al obtener el historial: " + String(err) },
      { status: 500 }
    );
  }
}
