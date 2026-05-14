"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setCanReset(true);
        setChecking(false);
      }
    });

    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        setCanReset(true);
        setChecking(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      const { data: { user: u2 } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (u2) {
        setCanReset(true);
      }
      setChecking(false);
    }

    void checkSession();

    const t = window.setTimeout(() => {
      if (!cancelled) setChecking(false);
    }, 2500);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password.length < 6) {
      setMessage({ type: "err", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (password !== password2) {
      setMessage({ type: "err", text: "Las contraseñas no coinciden." });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    await supabase.auth.signOut();
    router.push("/login?passwordUpdated=1");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-slate-600">Comprobando enlace…</p>
      </main>
    );
  }

  if (!canReset) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 max-md:p-4">
        <div className="w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm max-md:p-6">
          <h1 className="text-lg font-bold text-amber-900">No hay sesión de recuperación</h1>
          <p className="mt-2 text-sm text-amber-800">
            Abre el enlace del correo o solicita uno nuevo en iniciar sesión.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-amber-900 underline">
            Ir a iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 max-md:p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm max-md:p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">Nueva contraseña</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-sm font-medium text-slate-700">Nueva contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <label className="text-sm font-medium text-slate-700">Repetir contraseña</label>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          {message && (
            <p className={message.type === "err" ? "text-sm text-red-600" : "text-sm text-green-600"}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/login" className="underline hover:text-slate-700">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
