import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET: obtener premios de una jornada o de todas las jornadas */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const jornadaId = searchParams.get("jornada_id");
  const season = searchParams.get("season");

  let query = supabase.from("quiniela_prizes").select(`
    *,
    jornadas:jornada_id (id, number, season),
    users:user_id (id, quiniela_name)
  `);

  if (jornadaId) {
    query = query.eq("jornada_id", jornadaId);
  } else if (season) {
    // Obtener jornadas de la temporada
    const { data: jornadas } = await supabase
      .from("jornadas")
      .select("id")
      .eq("season", season);
    const jornadaIds = (jornadas ?? []).map((j) => j.id);
    if (jornadaIds.length > 0) {
      query = query.in("jornada_id", jornadaIds);
    } else {
      return NextResponse.json({ prizes: [] });
    }
  }

  const { data: prizes, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prizes: prizes ?? [] });
}

/** POST: crear o actualizar premio */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dbUser } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { jornada_id, user_id, amount, notes } = body;

    if (!jornada_id || !user_id || amount == null) {
      return NextResponse.json(
        { error: "jornada_id, user_id y amount son requeridos." },
        { status: 400 }
      );
    }

    const amountNum = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(amountNum) || amountNum < 0) {
      return NextResponse.json({ error: "El monto debe ser un número positivo." }, { status: 400 });
    }

    const { data: prize, error: upsertError } = await supabase
      .from("quiniela_prizes")
      .upsert(
        {
          jornada_id,
          user_id,
          amount: amountNum,
          notes: notes?.trim() || null,
        },
        {
          onConflict: "jornada_id,user_id",
        }
      )
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json(
        { error: `Error al guardar el premio: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, prize });
  } catch (err) {
    console.error("Error creating/updating prize:", err);
    return NextResponse.json(
      { error: "Error al guardar el premio: " + String(err) },
      { status: 500 }
    );
  }
}
