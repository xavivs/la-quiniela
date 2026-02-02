"use client";

import { useState } from "react";

export default function UploadPointsHistory() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function handleUpload() {
    if (!file) {
      setMessage({ type: "error", text: "Selecciona un archivo Excel primero." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/quiniela/upload-points-history", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: data.message ?? `Se subieron ${data.inserted ?? 0} registros correctamente.`,
        });
        setFile(null);
      } else {
        setMessage({ type: "error", text: data.error ?? "Error al subir el archivo." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error de conexión: " + String(err) });
    }

    setLoading(false);
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <h3 className="mb-3 text-base font-medium text-slate-800">Subir puntos históricos (Excel)</h3>
      <p className="mb-3 text-sm text-slate-600">
        Sube un archivo Excel con el formato: primera fila con nombres de usuarios (Xavi, Laura, Montse, etc.), segunda fila opcional con "TOTAL" (se ignora), filas siguientes con "Jornada N" y puntos por usuario.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {file ? file.name : "Seleccionar archivo Excel"}
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={handleUpload}
          disabled={loading || !file}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Subiendo…" : "Subir puntos históricos"}
        </button>
      </div>
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
