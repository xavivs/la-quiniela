"use client";

import { useState } from "react";
import type { User } from "@/lib/types";
import type { UserRole } from "@/lib/types";
import EditPredictionsSection from "./EditPredictionsSection";
import type { Jornada } from "@/lib/types";
import type { QuinielaMatch, QuinielaPrediction } from "@/lib/types";

type QMatch = QuinielaMatch & { id: string };
type QPrediction = QuinielaPrediction & { id: string };

type Props = {
  users: User[];
  jornadas?: Array<Jornada & { matches: QMatch[] }>;
  predictions?: QPrediction[];
};

export default function SuperadminClient({ users, jornadas = [], predictions = [] }: Props) {
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

  const [activeTab, setActiveTab] = useState<"users" | "predictions">("users");

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-4 max-md:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors max-md:px-2 max-md:text-xs ${
              activeTab === "users"
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Gestión de usuarios
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("predictions")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors max-md:px-2 max-md:text-xs ${
              activeTab === "predictions"
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Editar predicciones
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "users" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
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
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-200">
            {users.map((u) => (
              <div key={u.id} className="p-4">
                <div className="mb-2 font-medium text-slate-800">{u.quiniela_name ?? "–"}</div>
                <div className="mb-2 text-sm text-slate-600">{u.email}</div>
                <div className="mb-3">
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
                </div>
                {u.role !== "superadmin" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving === u.id || u.role === "user"}
                      onClick={() => setRole(u.id, "user")}
                      className={`flex-1 rounded px-3 py-2 text-xs font-medium ${
                        u.role === "user"
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-700"
                      } disabled:opacity-50`}
                    >
                      User
                    </button>
                    <button
                      type="button"
                      disabled={saving === u.id || u.role === "admin"}
                      onClick={() => setRole(u.id, "admin")}
                      className={`flex-1 rounded px-3 py-2 text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-700"
                      } disabled:opacity-50`}
                    >
                      Admin
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "predictions" && (
        <div>
          <p className="mb-4 text-sm text-slate-600 max-md:text-xs">
            Edita las predicciones de los usuarios para cada jornada. Los cambios se aplicarán inmediatamente.
          </p>
          <EditPredictionsSection jornadas={jornadas} users={users} predictions={predictions} />
        </div>
      )}
    </div>
  );
}
