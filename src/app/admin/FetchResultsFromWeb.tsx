"use client";

const QUINIELA_RESULTADOS_URL = "https://www.loteriasyapuestas.es/es/resultados/quiniela";

export default function FetchResultsFromWeb() {
  return (
    <p className="mb-4 text-slate-600">
      Puedes consultar los resultados oficiales en{" "}
      <a
        href={QUINIELA_RESULTADOS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-slate-500"
      >
        loteriasyapuestas.es – Quiniela
      </a>
      . Introduce los resultados manualmente en cada jornada más abajo.
    </p>
  );
}
