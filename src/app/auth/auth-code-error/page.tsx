import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 max-md:p-4">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm max-md:p-6">
        <h1 className="text-xl font-bold text-red-900">Enlace no válido</h1>
        <p className="mt-3 text-sm text-red-800">
          El enlace de recuperación ha caducado o ya se ha usado. Solicita uno nuevo desde
          iniciar sesión → &quot;¿Olvidaste la contraseña?&quot;.
        </p>
        <p className="mt-2 text-xs text-red-700">
          En Supabase: Authentication → URL Configuration → añade tu URL con{" "}
          <code className="rounded bg-red-100 px-1">/auth/callback</code> en Redirect URLs
          (por ejemplo <code className="rounded bg-red-100 px-1">https://tu-dominio.vercel.app/**</code>
          ).
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </main>
  );
}
