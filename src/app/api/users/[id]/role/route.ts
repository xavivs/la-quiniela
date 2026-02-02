import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(context.params);
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  const myRole = (me?.role as UserRole) ?? "user";
  if (myRole !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin puede cambiar roles" }, { status: 403 });
  }

  const body = await _request.json();
  const role = body.role as string;
  if (!["user", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Solo se puede asignar rol 'user' o 'admin' desde la app" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("users").update({ role }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
