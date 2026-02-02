import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLACEHOLDER_TEAM = "—";

/** GET: obtener jornadas (opcionalmente filtradas por temporada) */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");

  let query = supabase.from("jornadas").select("*").order("number", { ascending: false });

  if (season) {
    query = query.eq("season", season);
  }

  const { data: jornadas, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jornadas: jornadas ?? [] });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado. Inicia sesión." }, { status: 401 });

    const body = await request.json();
    const { number: numberRaw, season: seasonProvided, slip_image_url, matches } = body;
    
    // Si no se proporciona temporada, usar la activa
    let season = seasonProvided;
    if (!season) {
      const { data: activeSeason } = await supabase
        .from("seasons")
        .select("name")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      season = activeSeason?.name ?? "2024-25";
    }

    const number =
      typeof numberRaw === "number"
        ? numberRaw
        : typeof numberRaw === "string"
          ? parseInt(numberRaw, 10)
          : NaN;
    if (Number.isNaN(number) || number < 1) {
      return NextResponse.json({ error: "Número de jornada inválido (debe ser 1 o más)." }, { status: 400 });
    }
    if (!Array.isArray(matches)) {
      return NextResponse.json({ error: "matches debe ser un array de 15 partidos." }, { status: 400 });
    }
    const matchesList = Array.from({ length: 15 }, (_, i) => {
      const home = String(matches[i]?.home_team ?? "").trim();
      const away = String(matches[i]?.away_team ?? "").trim();
      return {
        home_team: home || PLACEHOLDER_TEAM,
        away_team: away || PLACEHOLDER_TEAM,
      };
    });

    const { data: jornada, error: errJ } = await supabase
      .from("jornadas")
      .insert({
        number,
        season,
        slip_image_url: slip_image_url ?? null,
      })
      .select("id")
      .single();

    if (errJ) {
      const msg = errJ.message || "";
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return NextResponse.json(
          { error: `Ya existe una jornada con número ${number} en la temporada "${season}". Usa otro número.` },
          { status: 400 }
        );
      }
      if (msg.includes("does not exist") || msg.includes("relation")) {
        return NextResponse.json(
          { error: "Tablas no encontradas. Ejecuta en Supabase el SQL: supabase/schema.sql y supabase/schema-quiniela.sql" },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    if (!jornada) return NextResponse.json({ error: "No se pudo crear la jornada." }, { status: 500 });

    for (let i = 0; i < 15; i++) {
      const m = matchesList[i];
      const matchOrder = i + 1;
      const row: Record<string, unknown> = {
        jornada_id: jornada.id,
        match_order: matchOrder,
        home_team: m?.home_team ?? PLACEHOLDER_TEAM,
        away_team: m?.away_team ?? PLACEHOLDER_TEAM,
      };
      if (matchOrder <= 14) {
        row.result_1x2 = null;
      } else {
        row.result_home = null;
        row.result_away = null;
      }
      const { error: errM } = await supabase.from("quiniela_matches").insert(row);
      if (errM) {
        const msg = errM.message || "";
        if (msg.includes("does not exist") || msg.includes("relation")) {
          return NextResponse.json(
            { error: "Tabla quiniela_matches no encontrada. Ejecuta supabase/schema-quiniela.sql en Supabase." },
            { status: 500 }
          );
        }
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, id: jornada.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear la jornada.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
