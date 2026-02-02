import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { home_team, away_team, date } = body;

  if (typeof home_team !== "string" || typeof away_team !== "string") {
    return NextResponse.json(
      { error: "Invalid body: home_team and away_team required" },
      { status: 400 }
    );
  }

  const dateValue = date ? new Date(date).toISOString() : new Date().toISOString();

  const { data, error } = await supabase
    .from("matches")
    .insert({
      home_team: home_team.trim(),
      away_team: away_team.trim(),
      date: dateValue,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
