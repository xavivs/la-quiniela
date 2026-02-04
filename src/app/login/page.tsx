"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    setMessage({ type: "ok", text: "Sesión iniciada. Redirigiendo..." });
    router.push("/dashboard");
    router.refresh();
  }

  const isEmailNotConfirmed =
    message?.type === "err" &&
    (message.text.toLowerCase().includes("email not confirmed") ||
      message.text.toLowerCase().includes("correo no confirmado"));

  async function handleResendConfirmation() {
    if (!email) return;
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    setMessage({
      type: "ok",
      text: "Correo de confirmación reenviado. Revisa tu bandeja (y spam).",
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 max-md:p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm max-md:p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">Iniciar sesión</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          {isEmailNotConfirmed && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={loading}
              className="text-sm font-medium text-slate-600 underline hover:text-slate-800 disabled:opacity-50"
            >
              Reenviar correo de confirmación
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="underline hover:text-slate-700">
            Volver al inicio
          </Link>
          {" · "}
          <Link href="/signup" className="underline hover:text-slate-700">
            Registrarse
          </Link>
        </p>
      </div>
    </main>
  );
}
