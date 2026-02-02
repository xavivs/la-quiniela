"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [quinielaName, setQuinielaName] = useState<string>("");
  const [takenNames, setTakenNames] = useState<string[]>([]);
  const [loadingNames, setLoadingNames] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchTakenNames() {
      const { data } = await supabase
        .from("users")
        .select("quiniela_name")
        .not("quiniela_name", "is", null);
      setTakenNames((data ?? []).map((u) => u.quiniela_name as string));
      setLoadingNames(false);
    }
    fetchTakenNames();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quinielaName) {
      setMessage({ type: "err", text: "Elige tu nombre de la quiniela." });
      return;
    }
    if (takenNames.includes(quinielaName)) {
      setMessage({ type: "err", text: "Ese nombre ya está registrado." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { quiniela_name: quinielaName } },
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    setMessage({
      type: "ok",
      text: "Cuenta creada. Revisa tu correo para confirmar, o inicia sesión si la confirmación está desactivada.",
    });
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 max-md:p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm max-md:p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 max-md:text-xl">Registro</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              ¿Quién eres? Elige tu nombre de la quiniela
            </label>
            {loadingNames ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2 max-md:gap-2">
                  {QUINIELA_NAMES.map((name) => {
                    const taken = takenNames.includes(name);
                    const selected = quinielaName === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        disabled={taken}
                        onClick={() => !taken && setQuinielaName(name)}
                        className={`min-h-[44px] rounded-lg border px-3 py-2.5 text-sm font-medium transition max-md:min-h-[48px] ${
                          taken
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            : selected
                              ? "border-slate-800 bg-slate-800 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
                {takenNames.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Los nombres en gris ya están registrados.
                  </p>
                )}
              </div>
            )}
          </div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="tu@ejemplo.com"
          />
          <label className="text-sm font-medium text-slate-700">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          {message && (
            <p
              className={
                message.type === "err"
                  ? "text-sm text-red-600"
                  : "text-sm text-green-600"
              }
            >
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || loadingNames}
            className="mt-2 rounded-lg bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Registrarse"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/login" className="underline hover:text-slate-700">
            Iniciar sesión
          </Link>
          {" · "}
          <Link href="/" className="underline hover:text-slate-700">
            Inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
