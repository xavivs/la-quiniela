import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  parseQuinielaResultsByJornada,
  type ParsedJornadaResults,
} from "@/lib/parseQuinielaWeb";

const QUINIELA_URL = "https://www.loteriasyapuestas.es/es/resultados/quiniela";

async function fetchQuinielaHtml(): Promise<string> {
  const res = await fetch(QUINIELA_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });
  return res.text();
}

/**
 * Elige el bloque de la web cuyo número coincide con nuestra jornada.
 * Antes se usaban los 14 primeros 1X2 de todo el HTML → mezcla de jornadas y datos mal guardados.
 */
function pickResultsBlock(
  parsed: ParsedJornadaResults[],
  targetJornadaNumber: number
): { block: ParsedJornadaResults | null; hint?: string } {
  const exact = parsed.find((p) => p.number === targetJornadaNumber);
  if (exact?.result_1x2 && exact.result_1x2.length >= 14) {
    return { block: exact };
  }
  if (exact?.result_1x2 && exact.result_1x2.length > 0) {
    return {
      block: exact,
      hint: `La web solo devolvió ${exact.result_1x2.length} signos 1X2 para la jornada ${targetJornadaNumber}; completa el resto a mano.`,
    };
  }

  const unlabeled = parsed.find((p) => p.number === 0 && p.result_1x2 && p.result_1x2.length >= 14);
  if (unlabeled) {
    return {
      block: unlabeled,
      hint: "La página no marcaba el número de jornada; se usó el único bloque completo. Comprueba que sea la jornada correcta.",
    };
  }

  if (parsed.length === 1 && parsed[0].result_1x2 && parsed[0].result_1x2.length >= 14) {
    return {
      block: parsed[0],
      hint: "Solo un bloque en el HTML; verifica que coincida con tu jornada.",
    };
  }

  return { block: null };
}

/** GET: bloques por jornada detectados en la web (depuración). */
export async function GET() {
  try {
    const html = await fetchQuinielaHtml();
    const byJornada = parseQuinielaResultsByJornada(html);
    return NextResponse.json({
      ok: true,
      jornadas_detectadas: byJornada.map((j) => ({
        number: j.number,
        tiene_14: (j.result_1x2?.length ?? 0) >= 14,
        pleno: j.pleno_15 != null,
      })),
      message:
        byJornada.length > 0
          ? "Bloques encontrados (revisa `jornadas_detectadas`)."
          : "No se detectaron bloques (la página puede cargar por JS).",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error al leer la web.", details: String(err) },
      { status: 500 }
    );
  }
}

/** POST: fetch web and apply results to the latest jornada of the active season (not global max number). Optional body: { "jornada_id": "uuid" } to target a specific jornada in that season. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const html = await fetchQuinielaHtml();
    const parsedAll = parseQuinielaResultsByJornada(html);

    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("name")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const seasonName = activeSeason?.name ?? "2024-25";

    let targetJornadaId: string | null = null;
    let body: { jornada_id?: string } = {};
    try {
      const text = await request.text();
      if (text.trim()) body = JSON.parse(text) as { jornada_id?: string };
    } catch {
      /* empty body */
    }

    if (typeof body.jornada_id === "string" && body.jornada_id.length > 0) {
      const { data: jRow } = await supabase
        .from("jornadas")
        .select("id, season, number")
        .eq("id", body.jornada_id)
        .maybeSingle();
      if (!jRow) {
        return NextResponse.json({ error: "Jornada no encontrada." }, { status: 400 });
      }
      if (jRow.season !== seasonName) {
        return NextResponse.json(
          {
            error:
              "La jornada no pertenece a la temporada activa. Elige una jornada de la temporada actual o cambia la temporada activa.",
          },
          { status: 400 }
        );
      }
      targetJornadaId = jRow.id;
    } else {
      const { data: latestJornada } = await supabase
        .from("jornadas")
        .select("id, number")
        .eq("season", seasonName)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestJornada) {
        return NextResponse.json(
          { error: `No hay jornadas en la temporada activa (${seasonName}).` },
          { status: 400 }
        );
      }
      targetJornadaId = latestJornada.id;
    }

    const { data: jTarget } = await supabase
      .from("jornadas")
      .select("number")
      .eq("id", targetJornadaId)
      .maybeSingle();
    const targetNumber = jTarget?.number;
    if (targetNumber == null) {
      return NextResponse.json({ error: "No se pudo leer el número de la jornada." }, { status: 400 });
    }

    const { block, hint } = pickResultsBlock(parsedAll, targetNumber);
    if (!block?.result_1x2 || block.result_1x2.length === 0) {
      return NextResponse.json(
        {
          error: `No se encontraron signos 1X2 en la web para la jornada ${targetNumber}.`,
          hint:
            "Comprueba que la jornada esté publicada, que la página no sea solo JS, o introduce resultados a mano.",
          jornadas_en_web: parsedAll.map((p) => p.number),
        },
        { status: 422 }
      );
    }

    const result1x2 = block.result_1x2;
    const incomplete14 =
      result1x2.length < 14
        ? `Solo ${result1x2.length}/14 signos en la web para la jornada ${targetNumber}; completa el resto manualmente.`
        : null;
    const pleno15 = block.pleno_15;

    const { data: matches } = await supabase
      .from("quiniela_matches")
      .select("id, match_order")
      .eq("jornada_id", targetJornadaId)
      .order("match_order", { ascending: true });

    if (!matches || matches.length !== 15) {
      return NextResponse.json(
        { error: "La jornada no tiene 15 partidos." },
        { status: 400 }
      );
    }

    const byOrder = new Map(matches.map((m) => [m.match_order, m]));

    let updated = 0;
    for (let ord = 1; ord <= 14; ord++) {
      const m = byOrder.get(ord);
      const sign = result1x2[ord - 1];
      if (!m || !sign) continue;
      const { error } = await supabase
        .from("quiniela_matches")
        .update({ result_1x2: sign })
        .eq("id", m.id);
      if (!error) updated++;
    }
    const m15 = byOrder.get(15);
    if (m15 && pleno15) {
      const { error } = await supabase
        .from("quiniela_matches")
        .update({
          result_home: pleno15.home,
          result_away: pleno15.away,
        })
        .eq("id", m15.id);
      if (!error) updated++;
    }

    const note = [hint, incomplete14].filter(Boolean).join(" ");
    return NextResponse.json({
      ok: true,
      message: `Jornada ${targetNumber} (${seasonName}): ${updated} campos actualizados.${note ? " " + note : ""}`,
      updated,
      jornada_id: targetJornadaId,
      jornada_number: targetNumber,
      hint: note || null,
      pleno_aplicado: pleno15 != null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error al leer o aplicar resultados.", details: String(err) },
      { status: 500 }
    );
  }
}
