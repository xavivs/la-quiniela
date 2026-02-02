"use client";

import { useState } from "react";

type Props = {
  onSeasonCreated?: () => void;
};

export default function CreateSeasonForm({ onSeasonCreated }: Props = {}) {
  const [seasonName, setSeasonName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  async function handleCreateSeason() {
    if (!seasonName.trim()) {
      setMessage({ type: "error", text: "El nombre de la temporada es requerido." });
      return;
    }

    // Mostrar warning si no se ha confirmado
    if (!showWarning) {
      setShowWarning(true);
      return;
    }

    setLoading(true);
    setMessage(null);
    setShowWarning(false);

    try {
      const res = await fetch("/api/quiniela/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: seasonName.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: data.message ?? `Temporada "${seasonName}" creada correctamente.`,
        });
        setSeasonName("");
        // Llamar callback si existe, sino recargar página
        if (onSeasonCreated) {
          setTimeout(() => onSeasonCreated(), 500);
        } else {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        setMessage({ type: "error", text: data.error ?? "Error al crear la temporada." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error de conexión: " + String(err) });
    }

    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      <h3 className="mb-3 text-base font-medium text-slate-800">Crear nueva temporada</h3>
      <p className="mb-3 text-sm text-slate-600">
        Crea una nueva temporada para empezar desde cero. Las temporadas anteriores se archivarán automáticamente.
      </p>

      {showWarning && (
        <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <div className="mb-2 flex items-start gap-2">
            <svg
              className="h-5 w-5 shrink-0 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="mb-2 font-semibold text-amber-900">Atención: Archivado de temporada</h4>
              <p className="mb-2 text-sm text-amber-800">
                Al crear una nueva temporada, la temporada actual se archivará automáticamente. Esto significa:
              </p>
              <ul className="mb-3 ml-4 list-disc text-sm text-amber-800">
                <li>La temporada actual dejará de ser la activa</li>
                <li>El ranking de la temporada actual quedará archivado y solo se mostrará el de la nueva temporada</li>
                <li>Las jornadas de la temporada actual seguirán existiendo pero archivadas</li>
                <li>Los usuarios solo podrán votar en jornadas de la nueva temporada activa</li>
              </ul>
              <p className="text-sm font-medium text-amber-900">
                ¿Estás seguro de que quieres crear la temporada "{seasonName}"?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateSeason}
              disabled={loading}
              className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? "Creando…" : "Sí, crear temporada"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowWarning(false);
                setSeasonName("");
              }}
              disabled={loading}
              className="rounded border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!showWarning && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={seasonName}
            onChange={(e) => {
              setSeasonName(e.target.value);
              setMessage(null);
            }}
            placeholder="Ej: 2025-26, Temporada 2, etc."
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleCreateSeason}
            disabled={loading || !seasonName.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Crear nueva temporada
          </button>
        </div>
      )}

      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === "success" ? "text-green-700" : "text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
