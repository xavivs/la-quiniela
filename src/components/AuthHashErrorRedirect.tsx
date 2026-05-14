"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Supabase a veces devuelve errores de enlace caducado solo en el fragmento (#…),
 * que el servidor no ve. Si detectamos error en el hash en la home, mandamos al login.
 */
export function AuthHashErrorRedirect() {
  const router = useRouter();

  useEffect(() => {
    const raw = window.location.hash?.replace(/^#/, "");
    if (!raw) return;
    const params = new URLSearchParams(raw);
    const err = params.get("error") || params.get("error_code");
    if (!err) return;
    const code = params.get("error_code") || err;
    const login = new URL("/login", window.location.origin);
    login.searchParams.set("auth_err", code);
    const desc = params.get("error_description");
    if (desc) {
      login.searchParams.set("auth_err_msg", desc.slice(0, 400));
    }
    router.replace(`${login.pathname}?${login.searchParams.toString()}`);
  }, [router]);

  return null;
}
