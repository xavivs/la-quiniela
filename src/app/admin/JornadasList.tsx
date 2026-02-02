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
          expanded={expandedJornadaId === jornada.id}
          onToggle={() => setExpandedJornadaId(expandedJornadaId === jornada.id ? null : jornada.id)}
        />
      ))}
    </div>
  );
}
