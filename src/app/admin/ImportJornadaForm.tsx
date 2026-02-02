"use client";

import { useState } from "react";
import { parseTeamNamesFromText } from "@/lib/parseQuinielaWeb";

type MatchRow = {
  home_team: string;
  away_team: string;
};

export default function ImportJornadaForm() {
  const [number, setNumber] = useState("");
  const [slipImage, setSlipImage] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>(
    Array.from({ length: 15 }, () => ({ home_team: "", away_team: "" }))
  );
  const [loading, setLoading] = useState(false);
  const [fetchingTeams, setFetchingTeams] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);

  /** Carga Tesseract desde CDN para no depender del paquete en build (evita "Module not found" si no hay npm install). */
  let tesseractLoadPromise: Promise<unknown> | null = null;
  async function getTesseract() {
    const w = typeof window !== "undefined" ? (window as Window & { Tesseract?: unknown }) : null;
    if (w?.Tesseract) return w.Tesseract;
    
    // Evitar cargar múltiples veces
    if (tesseractLoadPromise) return tesseractLoadPromise;
    
    tesseractLoadPromise = new Promise<unknown>((resolve, reject) => {
      // Verificar si ya existe un script cargando
      const existingScript = document.querySelector('script[src*="tesseract"]');
      if (existingScript && !(window as Window & { Tesseract?: unknown }).Tesseract) {
        // Script está cargando pero aún no está disponible
        const checkInterval = setInterval(() => {
          const T = (window as Window & { Tesseract?: unknown }).Tesseract;
          if (T && typeof (T as { createWorker?: unknown }).createWorker === "function") {
            clearInterval(checkInterval);
            resolve(T);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!(window as Window & { Tesseract?: unknown }).Tesseract) {
            tesseractLoadPromise = null;
            reject(new Error("Tesseract no se cargó a tiempo"));
          }
        }, 10000); // Timeout después de 10 segundos
        return;
      }
      
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.onload = () => {
        // Esperar un momento para que Tesseract se inicialice completamente
        setTimeout(() => {
          const win = window as Window & { Tesseract?: unknown };
          const T = win.Tesseract;
          if (T && typeof (T as { createWorker?: unknown }).createWorker === "function") {
            resolve(T);
          } else {
            tesseractLoadPromise = null;
            reject(new Error("Tesseract no está disponible correctamente después de cargar"));
          }
        }, 100);
      };
      script.onerror = () => {
        tesseractLoadPromise = null; // Reset para permitir reintento
        reject(new Error("No se pudo cargar OCR. Comprueba la conexión."));
      };
      document.head.appendChild(script);
    });
    
    return tesseractLoadPromise;
  }

  async function runOcrOnImage(file: File) {
    setOcrLoading(true);
    setOcrMessage("Cargando OCR…");
    setOcrRawText(null);
    try {
      const Tesseract = (await getTesseract()) as {
        createWorker: (lang: string, oem?: number, opts?: unknown) => Promise<{
          setParameters: (p: Record<string, number>) => Promise<void>;
          recognize: (img: File, opts?: unknown) => Promise<{ data: { text?: string } }>;
          terminate: () => Promise<void>;
        }>;
      };
      if (!Tesseract || typeof Tesseract.createWorker !== "function") {
        throw new Error("Tesseract no está disponible correctamente");
      }
      setOcrMessage("Analizando imagen (español)… Puede tardar unos segundos.");
      // No pasar logger: con Tesseract desde CDN + Workers, postMessage no puede clonar funciones y da DataCloneError.
      const worker = await Tesseract.createWorker("spa", 1);
      if (!worker) {
        throw new Error("No se pudo crear el worker de Tesseract");
      }
      await worker.setParameters({ tessedit_pageseg_mode: 6 });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const raw = (data?.text ?? "").trim();
      setOcrRawText(raw || null);
      const parsed = parseTeamNamesFromText(raw);
      if (parsed.length > 0) {
        setMatches(
          Array.from({ length: 15 }, (_, i) => ({
            home_team: parsed[i]?.home_team ?? "",
            away_team: parsed[i]?.away_team ?? "",
          }))
        );
        setOcrMessage(`OCR: ${parsed.length} partidos detectados. Revisa la tabla.`);
      } else {
        setOcrMessage("OCR no detectó partidos (Local - Visitante). Revisa el texto leído abajo o sube otra imagen.");
      }
    } catch (err) {
      console.error("OCR Error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setOcrMessage(
        errorMessage.includes("cargar") || errorMessage.includes("load") || errorMessage.includes("conexión")
          ? `No se pudo cargar OCR: ${errorMessage}. Comprueba la conexión o rellena la tabla a mano.`
          : `Error en OCR: ${errorMessage}. Rellena la tabla a mano.`
      );
    }
    setOcrLoading(false);
  }

  async function fetchTeamsFromWeb() {
    setFetchingTeams(true);
    setMessage(null);
    try {
      const res = await fetch("/api/quiniela/fetch-teams-web");
      const data = await res.json();
      if (res.ok && Array.isArray(data.matches)) {
        const list = data.matches.slice(0, 15).map((m: MatchRow) => ({
          home_team: String(m?.home_team ?? "").trim(),
          away_team: String(m?.away_team ?? "").trim(),
        }));
        setMatches(
          Array.from({ length: 15 }, (_, i) => ({
            home_team: list[i]?.home_team ?? "",
            away_team: list[i]?.away_team ?? "",
          }))
        );
        setMessage(data.message ?? (list.some((r: MatchRow) => r.home_team || r.away_team) ? "Equipos cargados." : "No se encontraron partidos en la web."));
      } else {
        setMessage(data.message ?? data.error ?? "No se pudieron leer los equipos.");
      }
    } catch {
      setMessage("Error de conexión.");
    }
    setFetchingTeams(false);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSlipImage(f);
    setMessage(null);
    setOcrMessage(null);
    setOcrRawText(null);
    setSlipPreview(URL.createObjectURL(f));
  }

  function updateMatch(i: number, field: keyof MatchRow, value: string) {
    const next = [...matches];
    (next[i] as Record<string, string>)[field] = value;
    setMatches(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(number, 10);
    if (isNaN(num)) {
      setMessage("Número de jornada inválido.");
      return;
    }
    setLoading(true);
    setMessage(null);
    
    // Obtener temporada activa
    let activeSeason = "2024-25";
    try {
      const resSeason = await fetch("/api/quiniela/seasons");
      const dataSeason = await resSeason.json();
      if (dataSeason.seasons && Array.isArray(dataSeason.seasons)) {
        const active = dataSeason.seasons.find((s: { is_active: boolean }) => s.is_active);
        if (active) activeSeason = active.name;
      }
    } catch {
      // Usar default si falla
    }
    
    let slipUrl: string | null = null;
    if (slipImage) {
      try {
        const form = new FormData();
        form.append("file", slipImage);
        const resUpload = await fetch("/api/upload/slip", { method: "POST", body: form });
        if (resUpload.ok) {
          const dataUpload = await resUpload.json();
          slipUrl = dataUpload.url ?? null;
        }
        // Si falla la subida, seguimos sin foto; la jornada se crea igual
      } catch {
        // Ignorar: crear jornada sin imagen
      }
    }
    const payload = {
      number: num,
      season: activeSeason,
      slip_image_url: slipUrl,
      matches: matches.map((m) => ({
        home_team: m.home_team.trim(),
        away_team: m.away_team.trim(),
      })),
    };
    let data: { error?: string } = {};
    try {
      const res = await fetch("/api/quiniela/jornadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setMessage(data.error ?? "Error al crear la jornada.");
        return;
      }
    } catch (err) {
      setLoading(false);
      setMessage(err instanceof Error ? err.message : "Error de conexión al crear la jornada.");
      return;
    }
    setMessage("Jornada creada.");
    setNumber("");
    setSlipImage(null);
    setSlipPreview(null);
    setOcrMessage(null);
    setOcrRawText(null);
    setMatches(Array.from({ length: 15 }, () => ({ home_team: "", away_team: "" })));
    window.location.reload();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">
        Nueva jornada (solo equipos)
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        Crea una jornada con los 15 partidos. Los resultados se introducen después en &quot;Actualizar resultados&quot;.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Rellenar equipos con imagen (recomendado)
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Sube una foto del boleto o una captura de pantalla de la web de la Quiniela. Funciona mejor si la imagen es clara y se ve &quot;Local - Visitante&quot; en cada línea.
            </p>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-600">Foto o captura</span>
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                disabled={ocrLoading}
                className="block text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-slate-700 disabled:opacity-50"
              />
            </label>
            {slipPreview && slipImage && (
              <>
                <img
                  src={slipPreview}
                  alt="Vista previa"
                  className="mt-2 max-h-48 rounded border border-slate-200 object-contain"
                />
                <button
                  type="button"
                  onClick={() => runOcrOnImage(slipImage)}
                  disabled={ocrLoading}
                  className="mt-2 rounded bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  {ocrLoading ? "Leyendo imagen…" : "Leer equipos de la imagen (OCR)"}
                </button>
                {ocrMessage && (
                  <p className={`mt-2 text-sm ${
                    ocrMessage.startsWith("Error") || ocrMessage.includes("no detectó") || ocrMessage.includes("No se pudo")
                      ? "text-red-600"
                      : "text-green-700"
                  }`}>
                    {ocrMessage}
                  </p>
                )}
                {ocrRawText != null && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                      Ver texto leído por OCR (para revisar)
                    </summary>
                    <pre className="mt-1 max-h-32 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 whitespace-pre-wrap">
                      {ocrRawText || "(vacío)"}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Número de jornada</label>
            <input
              type="number"
              min={1}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
              className="rounded border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-2 py-2 text-left font-medium text-slate-700">#</th>
                <th className="px-2 py-2 text-left font-medium text-slate-700">Local</th>
                <th className="px-2 py-2 text-left font-medium text-slate-700">Visitante</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => {
                const thickBorder = [4, 8, 11, 14].includes(i + 1);
                return (
                <tr
                  key={i}
                  className={thickBorder ? "border-b-2 border-slate-300" : "border-b border-slate-100"}
                >
                  <td className="px-2 py-2 text-slate-600">{i + 1}</td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={m.home_team}
                      onChange={(e) => updateMatch(i, "home_team", e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1"
                      placeholder="Equipo local"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={m.away_team}
                      onChange={(e) => updateMatch(i, "away_team", e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1"
                      placeholder="Equipo visitante"
                    />
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        {message && (
          <p className={`text-sm ${message.startsWith("Error") || message.includes("inválido") ? "text-red-600" : "text-slate-600"}`}>
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear jornada"}
        </button>
      </form>
    </div>
  );
}
