import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const QUINIELA_URL = "https://www.loteriasyapuestas.es/es/resultados/quiniela";

async function fetchAndParseQuinielaWeb() {
  const res = await fetch(QUINIELA_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });
  const html = await res.text();

  const results: string[] = [];
  const oneXTwo = html.matchAll(
    /(?:resultado|result|quiniela|celda|numero)[^>]*>[\s]*([1Xx2])[\s]*</gi
  );
  for (const m of oneXTwo) {
    const v = m[1].toUpperCase();
    if (v === "X" || v === "1" || v === "2") results.push(v);
  }
  if (results.length < 14) {
    const alt = html.matchAll(/["']([1Xx2])["']/g);
    for (const m of alt) {
      const v = m[1].toUpperCase();
      if (v === "X" || v === "1" || v === "2") results.push(v);
    }
  }

  let plenoHome: string | null = null;
  let plenoAway: string | null = null;
  const plenoMatch = html.match(
    /pleno[^0-9M]*([01M2])[\s\-]+([01M2])|([01M2])[\s\-]+([01M2])[^0-9M]*pleno/i
  );
  if (plenoMatch) {
    plenoHome = (plenoMatch[1] ?? plenoMatch[3])?.toUpperCase() ?? null;
    plenoAway = (plenoMatch[2] ?? plenoMatch[4])?.toUpperCase() ?? null;
  }

  const result1x2 = results.length >= 14 ? results.slice(0, 14) : null;
  const pleno15 =
    plenoHome && plenoAway
      ? { home: plenoHome as "0" | "1" | "2" | "M", away: plenoAway as "0" | "1" | "2" | "M" }
      : null;

  return {
    result1x2,
    pleno15,
    raw_count: (result1x2?.length ?? 0) + (pleno15 ? 1 : 0),
  };
}

/** GET: return parsed results from web (for testing). */
export async function GET() {
  try {
    const { result1x2, pleno15, raw_count } = await fetchAndParseQuinielaWeb();
    return NextResponse.json({
      ok: true,
      result_1x2: result1x2,
      pleno_15: pleno15,
      raw_count,
      message:
        result1x2 || pleno15
          ? "Datos extraídos."
          : "No se pudieron extraer resultados (la página puede cargar datos por JS).",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error al leer la web.", details: String(err) },
      { status: 500 }
    );
  }
}

/** POST: fetch web and apply results to current (latest) jornada. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { result1x2, pleno15 } = await fetchAndParseQuinielaWeb();

    const { data: latestJornada } = await supabase
      .from("jornadas")
      .select("id")
      .order("number", { ascending: false })
      .limit(1)
      .single();

    if (!latestJornada) {
      return NextResponse.json(
        { error: "No hay ninguna jornada. Crea una primero." },
        { status: 400 }
      );
    }

    const { data: matches } = await supabase
      .from("quiniela_matches")
      .select("id, match_order")
      .eq("jornada_id", latestJornada.id)
      .order("match_order", { ascending: true });

    if (!matches || matches.length !== 15) {
      return NextResponse.json(
        { error: "La jornada no tiene 15 partidos." },
        { status: 400 }
      );
    }

    let updated = 0;
    for (let i = 0; i < 15; i++) {
      const m = matches[i];
      if (i < 14 && result1x2?.[i]) {
        const { error } = await supabase
          .from("quiniela_matches")
          .update({ result_1x2: result1x2[i] })
          .eq("id", m.id);
        if (!error) updated++;
      } else if (i === 14 && pleno15) {
        const { error } = await supabase
          .from("quiniela_matches")
          .update({
            result_home: pleno15.home,
            result_away: pleno15.away,
          })
          .eq("id", m.id);
        if (!error) updated++;
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Resultados actualizados: ${updated} partidos. Si la web no devolvió datos completos, completa el resto manualmente.`,
      updated,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error al leer o aplicar resultados.", details: String(err) },
      { status: 500 }
    );
  }
}
