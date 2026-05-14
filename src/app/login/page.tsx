"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const pwd = searchParams.get("passwordUpdated");
    const authErr = searchParams.get("auth_err");
    const authErrMsg = searchParams.get("auth_err_msg");

    if (pwd === "1") {
      setMessage({
        type: "ok",
        text: "Contraseña actualizada. Inicia sesión con la nueva contraseña.",
      });
      router.replace("/login", { scroll: false });
      return;
    }

    if (authErr) {
      const msgRaw = authErrMsg ? safeDecode(authErrMsg) : "";
      const expired =
        authErr === "otp_expired" ||
        authErr === "access_denied" ||
        (msgRaw && /invalid|expired|caducad/i.test(msgRaw));
      if (expired) {
        setMessage({
          type: "err",
          text: "El enlace del correo ha caducado o no es válido (solo sirve unos minutos). Pulsa «¿Olvidaste la contraseña?» y pide uno nuevo.",
        });
      } else {
        const detail = authErrMsg ? safeDecode(authErrMsg) : authErr;
        setMessage({
          type: "err",
          text: `No se pudo validar el enlace: ${detail.slice(0, 220)}`,
        });
      }
      router.replace("/login", { scroll: false });
    }
  }, [searchParams, router]);

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

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    const addr = (forgotEmail || email).trim();
    if (!addr) {
      setMessage({ type: "err", text: "Indica tu correo electrónico." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const origin = window.location.origin;
    const next = encodeURIComponent("/auth/reset-password");
    const redirectTo = `${origin}/auth/callback?next=${next}`;
    const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo });
    setLoading(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    setMessage({
      type: "ok",
      text: "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.",
    });
    setShowForgot(false);
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
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-700">Contraseña</label>
            <button
              type="button"
              onClick={() => {
                setShowForgot((v) => !v);
                setForgotEmail(email);
                setMessage(null);
              }}
              className="text-xs font-medium text-slate-600 underline hover:text-slate-800"
            >
              ¿Olvidaste la contraseña?
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          {showForgot && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs text-slate-600">
                Te enviaremos un enlace (válido unos minutos). Revisa también spam.
              </p>
              <label className="text-xs font-medium text-slate-700">Correo para recuperar</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder={email || "tu@ejemplo.com"}
              />
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
              >
                {loading ? "Enviando…" : "Enviar enlace de recuperación"}
              </button>
            </div>
          )}
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-8 max-md:p-4">
          <p className="text-slate-600">Cargando…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
