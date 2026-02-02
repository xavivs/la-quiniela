import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET: obtener todas las temporadas */
export async function GET() {
  const supabase = await createClient();
  const { data: seasons } = await supabase
    .from("seasons")
    .select("*")
    .order("created_at", { ascending: false });
  return NextResponse.json({ seasons: seasons ?? [] });
}

/** POST: crear nueva temporada (archiva las anteriores) */
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
    const { name } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "El nombre de la temporada es requerido." }, { status: 400 });
    }

    const seasonName = name.trim();

    // Verificar que no existe ya una temporada con ese nombre
    const { data: existing } = await supabase
      .from("seasons")
      .select("id")
      .eq("name", seasonName)
      .single();
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe una temporada con el nombre "${seasonName}".` },
        { status: 400 }
      );
    }

    // Archivar temporadas anteriores (marcar como no activas)
    const { error: archiveError } = await supabase.rpc("archive_previous_seasons");
    if (archiveError) {
      // Si la función no existe, hacerlo manualmente
      await supabase
        .from("seasons")
        .update({ is_active: false, archived_at: new Date().toISOString() })
        .eq("is_active", true);
    }

    // Crear nueva temporada activa
    const { data: newSeason, error: createError } = await supabase
      .from("seasons")
      .insert({
        name: seasonName,
        is_active: true,
      })
      .select("id, name, is_active, created_at")
      .single();

    if (createError) {
      return NextResponse.json(
        { error: `Error al crear la temporada: ${createError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      season: newSeason,
      message: `Nueva temporada "${seasonName}" creada. Las temporadas anteriores han sido archivadas.`,
    });
  } catch (err) {
    console.error("Error creating season:", err);
    return NextResponse.json(
      { error: "Error al crear la temporada: " + String(err) },
      { status: 500 }
    );
  }
}
