import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** DELETE: eliminar temporada */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

  const resolvedParams = await Promise.resolve(params);
  const seasonId = resolvedParams.id;

  try {
    // Verificar que la temporada existe
    const { data: season } = await supabase
      .from("seasons")
      .select("id, name, is_active")
      .eq("id", seasonId)
      .single();

    if (!season) {
      return NextResponse.json({ error: "Temporada no encontrada." }, { status: 404 });
    }

    // No permitir eliminar la temporada activa
    if (season.is_active) {
      return NextResponse.json(
        { error: "No se puede eliminar la temporada activa. Crea una nueva temporada primero." },
        { status: 400 }
      );
    }

    // Verificar si tiene jornadas asociadas
    const { data: jornadas } = await supabase
      .from("jornadas")
      .select("id")
      .eq("season", season.name)
      .limit(1);

    if (jornadas && jornadas.length > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar la temporada "${season.name}" porque tiene ${jornadas.length} jornada(s) asociada(s). Elimina las jornadas primero.`,
        },
        { status: 400 }
      );
    }

    // Eliminar la temporada
    const { error: deleteError } = await supabase.from("seasons").delete().eq("id", seasonId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Error al eliminar la temporada: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Temporada "${season.name}" eliminada correctamente.`,
    });
  } catch (err) {
    console.error("Error deleting season:", err);
    return NextResponse.json(
      { error: "Error al eliminar la temporada: " + String(err) },
      { status: 500 }
    );
  }
}
