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
  const { match_id, predicted_home_score, predicted_away_score } = body;

  if (
    typeof match_id !== "string" ||
    typeof predicted_home_score !== "number" ||
    typeof predicted_away_score !== "number"
  ) {
    return NextResponse.json(
      { error: "Invalid body: match_id, predicted_home_score, predicted_away_score required" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      match_id,
      predicted_home_score,
      predicted_away_score,
    },
    { onConflict: "user_id,match_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
