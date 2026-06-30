import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PATCH: admin actualiza nombres de equipos de partidos existentes */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado. Inicia sesión." }, { status: 401 });

  const { data: dbUser } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Solo admin puede editar equipos." }, { status: 403 });
  }

  const body = await request.json();

  if (Array.isArray(body.matches)) {
    const list = body.matches as Array<{
      id: string;
      home_team?: string;
      away_team?: string;
    }>;
    for (const item of list) {
      if (typeof item.id !== "string") continue;
      const payload: Record<string, string> = {};
      if (typeof item.home_team === "string") payload.home_team = item.home_team.trim();
      if (typeof item.away_team === "string") payload.away_team = item.away_team.trim();
      if (Object.keys(payload).length === 0) continue;
      const { error } = await supabase.from("quiniela_matches").update(payload).eq("id", item.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { id, home_team, away_team } = body;
  if (typeof id !== "string") {
    return NextResponse.json({ error: "id de partido requerido" }, { status: 400 });
  }

  const payload: Record<string, string> = {};
  if (typeof home_team === "string") payload.home_team = home_team.trim();
  if (typeof away_team === "string") payload.away_team = away_team.trim();
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "home_team o away_team requerido" }, { status: 400 });
  }

  const { error } = await supabase.from("quiniela_matches").update(payload).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
