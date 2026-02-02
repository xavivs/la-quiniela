import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Batch: { results: [ { quiniela_match_id, result_1x2? }, { quiniela_match_id, result_home, result_away }, ... ] }
  if (Array.isArray(body.results)) {
    const list = body.results as Array<{
      quiniela_match_id: string;
      result_1x2?: string;
      result_home?: string;
      result_away?: string;
    }>;
    for (const item of list) {
      if (typeof item.quiniela_match_id !== "string") continue;
      const payload: Record<string, unknown> = {};
      if (item.result_1x2 !== undefined) payload.result_1x2 = item.result_1x2;
      if (item.result_home !== undefined) payload.result_home = item.result_home;
      if (item.result_away !== undefined) payload.result_away = item.result_away;
      if (Object.keys(payload).length === 0) continue;
      const { error } = await supabase
        .from("quiniela_matches")
        .update(payload)
        .eq("id", item.quiniela_match_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Single result (legacy)
  const { quiniela_match_id, result_1x2, result_home, result_away } = body;
  if (typeof quiniela_match_id !== "string") {
    return NextResponse.json({ error: "quiniela_match_id required" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (result_1x2 !== undefined) payload.result_1x2 = result_1x2;
  if (result_home !== undefined) payload.result_home = result_home;
  if (result_away !== undefined) payload.result_away = result_away;

  const { error } = await supabase
    .from("quiniela_matches")
    .update(payload)
    .eq("id", quiniela_match_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
