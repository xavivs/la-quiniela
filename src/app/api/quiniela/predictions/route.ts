import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Solo los 8 usuarios de la quiniela pueden votar (deben existir en public.users con quiniela_name válido)
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, quiniela_name")
    .eq("id", user.id)
    .single();

  if (!dbUser || !dbUser.quiniela_name || !QUINIELA_NAMES.includes(dbUser.quiniela_name as (typeof QUINIELA_NAMES)[number])) {
    return NextResponse.json(
      {
        error:
          "Solo los usuarios de la quiniela (Xavi, Laura, Montse, Lluís, Jordi, Neus, Denci, Marià) pueden votar. Si eres uno de ellos, pide al admin que te asigne tu nombre en la base de datos.",
      },
      { status: 403 }
    );
  }

  const body = await request.json();

  // Batch: { predictions: [ { quiniela_match_id, predicted_1x2? }, { quiniela_match_id, predicted_home, predicted_away }, ... ] }
  if (Array.isArray(body.predictions)) {
    const list = body.predictions as Array<{
      quiniela_match_id: string;
      predicted_1x2?: string;
      predicted_home?: string;
      predicted_away?: string;
    }>;
    if (list.length === 0) return NextResponse.json({ error: "predictions array empty" }, { status: 400 });
    for (const item of list) {
      if (typeof item.quiniela_match_id !== "string") {
        return NextResponse.json({ error: "quiniela_match_id required in each item" }, { status: 400 });
      }
      const payload = {
        user_id: user.id,
        quiniela_match_id: item.quiniela_match_id,
        predicted_1x2: item.predicted_1x2 ?? null,
        predicted_home: item.predicted_home ?? null,
        predicted_away: item.predicted_away ?? null,
      };
      const { error } = await supabase
        .from("quiniela_predictions")
        .upsert(payload, { onConflict: "user_id,quiniela_match_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Single prediction (legacy)
  const { quiniela_match_id, predicted_1x2, predicted_home, predicted_away } = body;
  if (typeof quiniela_match_id !== "string") {
    return NextResponse.json({ error: "quiniela_match_id required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("quiniela_predictions")
    .select("predicted_1x2, predicted_home, predicted_away")
    .eq("user_id", user.id)
    .eq("quiniela_match_id", quiniela_match_id)
    .single();

  const payload: Record<string, unknown> = {
    user_id: user.id,
    quiniela_match_id,
    predicted_1x2: predicted_1x2 ?? existing?.predicted_1x2 ?? null,
    predicted_home: predicted_home ?? existing?.predicted_home ?? null,
    predicted_away: predicted_away ?? existing?.predicted_away ?? null,
  };

  const { error } = await supabase
    .from("quiniela_predictions")
    .upsert(payload, { onConflict: "user_id,quiniela_match_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
