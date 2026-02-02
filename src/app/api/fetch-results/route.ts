import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMatchResults } from "@/lib/fetchMatchResults";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await fetchMatchResults();
  if (!results.length) {
    return NextResponse.json({
      message: "No results from API (placeholder returns empty). Connect your API in src/lib/fetchMatchResults.ts",
    });
  }

  let updated = 0;
  for (const r of results) {
    const { error } = await supabase
      .from("matches")
      .update({
        real_home_score: r.homeScore,
        real_away_score: r.awayScore,
      })
      .eq("id", r.matchId);

    if (!error) updated++;
  }

  return NextResponse.json({
    message: `Updated ${updated} match(es).`,
    updated,
  });
}
