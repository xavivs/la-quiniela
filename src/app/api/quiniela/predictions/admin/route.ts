import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PATCH: Superadmin puede modificar predicciones de cualquier usuario */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verificar que es superadmin
  const { data: dbUser } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";
  if (role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden: solo superadmin puede modificar predicciones" }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, predictions } = body;

  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json({ error: "user_id requerido" }, { status: 400 });
  }

  if (!Array.isArray(predictions)) {
    return NextResponse.json({ error: "predictions debe ser un array" }, { status: 400 });
  }

  // Actualizar predicciones en batch
  for (const pred of predictions) {
    const { quiniela_match_id, predicted_1x2, predicted_home, predicted_away } = pred;
    if (typeof quiniela_match_id !== "string") continue;

    const payload: Record<string, unknown> = {
      user_id,
      quiniela_match_id,
      predicted_1x2: predicted_1x2 ?? null,
      predicted_home: predicted_home ?? null,
      predicted_away: predicted_away ?? null,
    };

    const { error } = await supabase
      .from("quiniela_predictions")
      .upsert(payload, { onConflict: "user_id,quiniela_match_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
