"use client";

import { useState } from "react";
import type { User } from "@/lib/types";
import type { UserRole } from "@/lib/types";

type Props = { users: User[] };

export default function SuperadminClient({ users }: Props) {
  const [saving, setSaving] = useState<string | null>(null);

  async function setRole(userId: string, role: UserRole) {
    if (role === "superadmin") return;
    setSaving(userId);
    const res = await fetch(`/api/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al cambiar el rol.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-700">Nombre</th>
            <th className="px-4 py-3 text-left font-medium text-slate-700">Email</th>
            <th className="px-4 py-3 text-left font-medium text-slate-700">Rol actual</th>
            <th className="px-4 py-3 text-left font-medium text-slate-700">Asignar rol</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{u.quiniela_name ?? "–"}</td>
              <td className="px-4 py-3 text-slate-600">{u.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    u.role === "superadmin"
                      ? "bg-amber-100 text-amber-800"
                      : u.role === "admin"
                        ? "bg-slate-200 text-slate-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {u.role ?? "user"}
                </span>
              </td>
              <td className="px-4 py-3">
                {u.role === "superadmin" ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving === u.id || u.role === "user"}
                      onClick={() => setRole(u.id, "user")}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        u.role === "user"
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      } disabled:opacity-50`}
                    >
                      User
                    </button>
                    <button
                      type="button"
                      disabled={saving === u.id || u.role === "admin"}
                      onClick={() => setRole(u.id, "admin")}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      } disabled:opacity-50`}
                    >
                      Admin
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
