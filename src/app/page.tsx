import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const hasSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSupabase) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-2xl font-bold text-slate-800">
          La Quiniela
        </h1>
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-medium text-amber-800">Supabase no configurado</p>
          <p className="mt-2 text-sm text-amber-700">
            Copia <code className="rounded bg-amber-100 px-1">.env.example</code> en{" "}
            <code className="rounded bg-amber-100 px-1">.env.local</code> y añade
            tu <strong>NEXT_PUBLIC_SUPABASE_URL</strong> y{" "}
            <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> desde Supabase Dashboard
            → Project Settings → API.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/semana");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12 max-md:px-4 max-md:py-8">
      {/* Fondo con gradiente y detalle */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-teal-900" />
      <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        {/* Icono / marca */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm max-md:mb-4 max-md:h-16 max-md:w-16">
          <span className="text-4xl max-md:text-3xl">⚽</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-sm max-md:text-3xl">
          La Quiniela
        </h1>
        <p className="mt-3 text-lg text-slate-200 max-md:mt-2 max-md:text-base">
          Pronóstico Quiniela · 14 + pleno al 15
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Pronostica, compite y sigue el ranking con tu grupo
        </p>

        <div className="mt-10 flex w-full flex-col gap-3 max-md:mt-8 max-md:gap-3">
          <Link
            href="/login"
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-white px-6 py-3.5 text-lg font-semibold text-slate-800 shadow-lg transition hover:bg-slate-100 active:scale-[0.98] max-md:min-h-[48px] max-md:text-base"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-white/50 px-6 py-3 text-white transition hover:border-white hover:bg-white/10 max-md:min-h-[44px] max-md:text-sm"
          >
            Crear cuenta
          </Link>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          ¿Primera vez? Regístrate y elige tu nombre de la quiniela.
        </p>
      </div>
    </main>
  );
}
