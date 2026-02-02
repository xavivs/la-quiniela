import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
