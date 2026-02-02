import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import Tabs from "@/components/Tabs";
import CurrentSeasonTab from "./CurrentSeasonTab";
import ManageSeasons from "./ManageSeasons";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dbUser } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";
  if (role !== "admin" && role !== "superadmin") redirect("/semana");

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8 max-md:px-3 max-md:py-5">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 max-md:mb-4 max-md:text-xl">Admin</h1>
        <Tabs
          tabs={[
            {
              id: "current-season",
              label: "Temporada actual",
              content: <CurrentSeasonTab />,
            },
            {
              id: "seasons",
              label: "Temporadas",
              content: <ManageSeasons />,
            },
          ]}
          defaultTab="current-season"
        />
      </main>
    </>
  );
}
