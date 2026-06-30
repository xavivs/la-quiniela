"use client";

import { useState } from "react";
import JornadaRow from "./JornadaRow";
import type { Jornada } from "@/lib/types";
import type { QuinielaMatch } from "@/lib/types";

type Props = { 
  jornadas: Array<Jornada & { matches: QuinielaMatch[] }>;
};

export default function JornadasList({ jornadas }: Props) {
  const [expandedJornadaId, setExpandedJornadaId] = useState<string | null>(null);

  // La jornada actual es la de mayor número no histórica (la que se ve en Semana)
  const latestJornadaId =
    jornadas
      .filter((j) => !j.is_historical)
      .sort((a, b) => b.number - a.number)[0]?.id ?? null;

  if (jornadas.length === 0) {
    return <p className="text-slate-500">No hay jornadas.</p>;
  }

  return (
    <div className="space-y-6">
      {jornadas.map(({ matches, ...jornada }) => (
        <JornadaRow 
          key={jornada.id} 
          jornada={jornada} 
          matches={matches}
          isLatestJornada={jornada.id === latestJornadaId}
          expanded={expandedJornadaId === jornada.id}
          onToggle={() => setExpandedJornadaId(expandedJornadaId === jornada.id ? null : jornada.id)}
        />
      ))}
    </div>
  );
}
