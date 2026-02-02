"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type UserRole = "user" | "admin" | "superadmin";

export default function Nav() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setRole(data.role ?? "user"))
      .catch(() => setRole("user"));
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const navLinks = (
    <>
      <Link
        href="/semana"
        className="text-slate-700 hover:text-slate-900 md:py-0"
        onClick={() => setMenuOpen(false)}
      >
        Semana
      </Link>
      <Link
        href="/ranking"
        className="text-slate-700 hover:text-slate-900 md:py-0"
        onClick={() => setMenuOpen(false)}
      >
        Ranking
      </Link>
      <Link
        href="/stats"
        className="text-slate-700 hover:text-slate-900 md:py-0"
        onClick={() => setMenuOpen(false)}
      >
        Estadísticas
      </Link>
      {(role === "admin" || role === "superadmin") && (
        <Link
          href="/admin"
          className="text-slate-700 hover:text-slate-900 md:py-0"
          onClick={() => setMenuOpen(false)}
        >
          Admin
        </Link>
      )}
      {role === "superadmin" && (
        <Link
          href="/superadmin"
          className="text-slate-700 hover:text-slate-900 md:py-0"
          onClick={() => setMenuOpen(false)}
        >
          Superadmin
        </Link>
      )}
    </>
  );

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        {/* Desktop: links inline */}
        <div className="hidden md:flex md:gap-6">
          {navLinks}
        </div>

        {/* Mobile: hamburger + drawer */}
        <div className="flex flex-1 items-center justify-between md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <button
            onClick={signOut}
            className="text-sm text-slate-500 hover:text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            Salir
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <div
          className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-white shadow-xl transition-transform duration-200 ease-out md:hidden ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col gap-1 pt-16 px-4 pb-6">
            <Link
              href="/semana"
              className="min-h-[48px] flex items-center rounded-lg px-4 text-slate-700 hover:bg-slate-100"
              onClick={() => setMenuOpen(false)}
            >
              Semana
            </Link>
            <Link
              href="/ranking"
              className="min-h-[48px] flex items-center rounded-lg px-4 text-slate-700 hover:bg-slate-100"
              onClick={() => setMenuOpen(false)}
            >
              Ranking
            </Link>
              <Link
              href="/stats"
              className="min-h-[48px] flex items-center rounded-lg px-4 text-slate-700 hover:bg-slate-100"
              onClick={() => setMenuOpen(false)}
            >
              Estadísticas
            </Link>
            {(role === "admin" || role === "superadmin") && (
              <Link
                href="/admin"
                className="min-h-[48px] flex items-center rounded-lg px-4 text-slate-700 hover:bg-slate-100"
                onClick={() => setMenuOpen(false)}
              >
                Admin
              </Link>
            )}
            {role === "superadmin" && (
              <Link
                href="/superadmin"
                className="min-h-[48px] flex items-center rounded-lg px-4 text-slate-700 hover:bg-slate-100"
                onClick={() => setMenuOpen(false)}
              >
                Superadmin
              </Link>
            )}
          </div>
        </div>

        {/* Desktop: sign out */}
        <button
          onClick={signOut}
          className="hidden text-sm text-slate-500 hover:text-slate-700 md:block"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
