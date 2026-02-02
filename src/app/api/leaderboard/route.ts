import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/leaderboard";

export async function GET() {
  const entries = await getLeaderboard();
  return NextResponse.json(entries);
}
