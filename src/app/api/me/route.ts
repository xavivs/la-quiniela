import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ user: null, role: null }, { status: 200 });

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, email, quiniela_name, role")
    .eq("id", user.id)
    .single();

  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";
  return NextResponse.json({
    user: { id: user.id, email: user.email, quiniela_name: dbUser?.quiniela_name ?? null },
    role,
  });
}
