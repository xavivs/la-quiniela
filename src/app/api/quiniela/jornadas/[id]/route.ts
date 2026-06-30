import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(context.params);
  if (!id) return NextResponse.json({ error: "id de jornada requerido" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado. Inicia sesión." }, { status: 401 });

  const { data: dbUser } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Solo admin puede modificar la votación." }, { status: 403 });
  }

  const body = await request.json();
  if (typeof body.voting_open !== "boolean") {
    return NextResponse.json({ error: "voting_open (boolean) requerido" }, { status: 400 });
  }

  const { data: jornada } = await supabase
    .from("jornadas")
    .select("id, season, number, is_historical")
    .eq("id", id)
    .single();

  if (!jornada) {
    return NextResponse.json({ error: "Jornada no encontrada." }, { status: 404 });
  }
  if (jornada.is_historical) {
    return NextResponse.json({ error: "No se puede cambiar la votación de una jornada histórica." }, { status: 400 });
  }

  const { data: latestInSeason } = await supabase
    .from("jornadas")
    .select("id, number")
    .eq("season", jornada.season)
    .or("is_historical.is.null,is_historical.eq.false")
    .order("number", { ascending: false })
    .limit(1)
    .single();

  if (!latestInSeason || latestInSeason.id !== id) {
    return NextResponse.json(
      { error: "Solo se puede abrir o cerrar la votación de la jornada actual (la más reciente)." },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from("jornadas")
    .update({ voting_open: body.voting_open })
    .eq("id", id)
    .select("id, voting_open")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) {
    return NextResponse.json({ error: "No se pudo actualizar la jornada." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, voting_open: updated.voting_open });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(context.params);
  if (!id) return NextResponse.json({ error: "id de jornada requerido" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado. Inicia sesión." }, { status: 401 });

  const { data: deleted, error } = await supabase
    .from("jornadas")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      {
        error:
          "No se pudo eliminar la jornada. Solo admin o superadmin pueden eliminarla. Si eres admin, verifica que tu rol esté asignado en Superadmin.",
      },
      { status: 403 }
    );
  }
  return NextResponse.json({ ok: true });
}
