import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import SuperadminClient from "./SuperadminClient";
import type { User } from "@/lib/types";

export default async function SuperadminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dbUser } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";
  if (role !== "superadmin") redirect("/semana");

  const { data: users } = await supabase
    .from("users")
    .select("id, email, quiniela_name, role")
    .not("quiniela_name", "is", null)
    .order("quiniela_name");

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">Superadmin</h1>
        <p className="mb-6 text-slate-600">
          Asigna el rol <strong>admin</strong> a usuarios para que puedan acceder a la pestaña Admin (crear jornadas, subir resultados, eliminar jornadas). El rol <strong>user</strong> solo puede votar y ver Semana/Ranking.
        </p>
        <SuperadminClient users={(users ?? []) as User[]} />
      </main>
    </>
  );
}
