import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET: obtener user_id desde quiniela_name */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "Parámetro 'name' requerido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("quiniela_name", name)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ user_id: user.id });
}
