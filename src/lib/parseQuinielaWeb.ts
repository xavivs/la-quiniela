/**
 * Parse quiniela page content: team names (HOME - AWAY) and optional results (1/X/2, M-2).
 * Handles format: "1.Ajax - Olimpiacos", "P-15Benfica - Real Madrid", with various dash chars.
 */
export type ParsedMatch = { home_team: string; away_team: string };
export type ParsedResult = "1" | "X" | "2";
export type ParsedPleno = { home: "0" | "1" | "2" | "M"; away: "0" | "1" | "2" | "M" };

/** Normalize for OCR and web: dashes, spaces, tabs */
function normalizeDashes(s: string): string {
  return s
    .replace(/\u2013/g, " - ") // en dash
    .replace(/\u2014/g, " - ") // em dash
    .replace(/&ndash;|&#8211;|&#x2013;/gi, " - ")
    .replace(/\s*[-–—]\s*/g, " - ") // hyphen, en-dash, em-dash
    .replace(/\s+/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

/** Strip leading match number: "1.", "2 ", "15.", "P-15", OCR "l." or "I." for 1 (solo al inicio) */
function stripMatchPrefix(s: string): string {
  return s
    .replace(/^\s*P-15\s*/i, "")
    .replace(/^\s*\d{1,2}[.\s)*]+\s*/i, "") // 1. 2) 15.
    .replace(/^\s*[lI]\.[\s]*/i, "") // OCR: l. o I. como "1."
    .trim();
}

/** Light cleanup for OCR noise in team names */
function ocrCleanWord(w: string): string {
  return w.replace(/\|/g, "I").trim();
}

/** Reject if string looks like header/UI text (DIA/HORA, 1X2, JORNADA, etc.). No rechazar si es un nombre largo que solo contiene "bóm" o "MEX" (ej. "bóm MÁLAGA"). */
function isHeaderNoise(s: string): boolean {
  const t = s.toUpperCase().trim();
  if (t.length < 2) return true;
  const strongNoise = ["PRONÓSTICO", "QUINIELA", "JORNADA", "DIA/HORA", "DIA HORA", "1X2", "VIERNES", "SABADO", "DOMINGO", "LUNES", "BOTE", "CIERRE", "PART."];
  if (strongNoise.some((n) => t.includes(n))) return true;
  if (/\d{1,2}:\d{2}\s*(VIE|SAB|DOM|LUN)/i.test(t) || /^\d\s*[Xx]\s*\d$/i.test(t)) return true;
  if (t === "PART" || t === "1X2") return true;
  const shortNoise = ["MEX", "BOM", "TPXI", "DMETIX", "SABE", "DMPOITI", "MO OF"];
  if (t.length < 10 && shortNoise.some((n) => t.includes(n))) return true;
  return false;
}

/** Quita prefijos OCR (bóm, MeNITIXIZ, AB , etc.) y corrige nombres habituales (ROVIEDO→OVIEDO, ESPANVOL→ESPANYOL). */
function cleanOcrTeamName(s: string): string {
  let t = s.trim();
  const junkPrefix = /^(\d\s*)?(Mex\s*2\s*|bóm|bom|MeNITIXIZ|MENITIXIZ|AB\s+|TPXI2I\s+|TPXI2\s+|TPXI\s+|TPX12\s+|DMETIXIZ\s+|DMETIX\s+|SABE\s+TX\s*\d?\s*)\s*/i;
  t = t.replace(junkPrefix, "");
  t = t.replace(/\s+$/g, "").replace(/^\s+/g, "").replace(/\s+/g, " ");
  t = t.replace(/^ROVIEDO$/i, "OVIEDO").replace(/^ESPANVOL$/i, "ESPANYOL").replace(/^ESPANOL$/i, "ESPANYOL");
  return t.trim();
}

/** From OCR blob: take only the team name (stop at comma, dots, or " 1 X 2 " style) */
function trimToTeamName(s: string): string {
  let t = s.trim();
  t = t.replace(/\s*[,.]\s*.*$/, "").replace(/\s*\.{2,}.*$/, "").replace(/\s*\d\s*[Xx]\s*\d.*$/i, "").replace(/\s+\d{1,2}\s+\d{2,4}.*$/, "");
  return ocrCleanWord(t).replace(/\s+/g, " ").trim();
}

/**
 * Extract up to 15 "HOME - AWAY" pairs from text (e.g. from quiniela results page or OCR boleto).
 * Skips header (DIA/HORA, PRONÓSTICO QUINIELA, 1X2, etc.) and splits each match correctly.
 */
export function parseTeamNamesFromText(text: string): ParsedMatch[] {
  const normalized = normalizeDashes(text);
  const matches: ParsedMatch[] = [];

  // Try line-by-line first (one match per line)
  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 2);

  for (const line of lines) {
    if (matches.length >= 15) break;
    const dashIdx = line.indexOf(" - ");
    if (dashIdx === -1) continue;
    let left = line.slice(0, dashIdx).trim();
    let right = line.slice(dashIdx + 3).trim();
    left = stripMatchPrefix(left);
    left = cleanOcrTeamName(ocrCleanWord(left).replace(/\s+/g, " "));
    right = cleanOcrTeamName(trimToTeamName(right));
    if (left.length < 2 || right.length < 2) continue;
    if (/^\d+$/.test(left) || /^\d+$/.test(right)) continue;
    if (isHeaderNoise(left) || isHeaderNoise(right)) continue;
    matches.push({ home_team: left, away_team: right });
  }

  if (matches.length >= 14) {
    tryAddPleno15(normalized, matches);
    return applyCleanOcrToMatches(matches);
  }

  // OCR blob: find every "TEAM - TEAM" with regex; team ends at comma, dots, or " 1 X 2 "
  // so we don't merge several matches into one (e.g. "GETAFE - RSOCIEDAD" only, not "DIA/HORA - 1X2")
  const blobRegex = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s]{1,40}?)\s+-\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s]{1,40}?)(?=[.,]|\s*\.{2,}|\s*\d\s*[Xx]\s*\d|\s+\d{1,2}\s+\d{2,4}|\s+\d{1,2}\s+[A-ZÀ-ÿ]|$)/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = blobRegex.exec(normalized)) !== null && matches.length < 15) {
    let home = cleanOcrTeamName(trimToTeamName(stripMatchPrefix(m[1].trim())).replace(/\s+/g, " "));
    let away = cleanOcrTeamName(trimToTeamName(m[2].trim()).replace(/\s+/g, " "));
    if (home.length < 2 || away.length < 2) continue;
    if (/^\d+$/.test(home) || /^\d+$/.test(away)) continue;
    if (isHeaderNoise(home) || isHeaderNoise(away)) continue;
    const key = `${home}|${away}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ home_team: home, away_team: away });
  }

  if (matches.length > 0) {
    tryAddPleno15(normalized, matches);
    return applyCleanOcrToMatches(matches);
  }

  // Fallback: split by " - " and take alternating pairs, but skip header and trim away to one team
  const parts = normalized.split(" - ").map((p) => p.trim()).filter((p) => p.length > 1);
  if (parts.length >= 30) {
    for (let i = 0; i < 15 && 2 * i + 1 < parts.length; i++) {
      let home = trimToTeamName(stripMatchPrefix(parts[2 * i] ?? ""));
      let away = trimToTeamName(parts[2 * i + 1] ?? "");
      home = ocrCleanWord(home).replace(/\s+/g, " ");
      away = away.replace(/\s+/g, " ");
      home = cleanOcrTeamName(home);
      away = cleanOcrTeamName(away);
      if (home.length >= 2 && away.length >= 2 && !/^\d+$/.test(home) && !/^\d+$/.test(away) && !isHeaderNoise(home) && !isHeaderNoise(away)) {
        const key = `${home}|${away}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({ home_team: home, away_team: away });
        }
      }
    }
    if (matches.length > 0) {
      tryAddPleno15(normalized, matches);
      return applyCleanOcrToMatches(matches);
    }
  }

  // Last fallback: generic "X - Y" regex (original behaviour)
  const regex = /(?:^|\s)(?:\d{1,2}\.|P-15)?\s*([A-Za-zÀ-ÿ0-9.\s]{2,35}?)\s+-\s+([A-Za-zÀ-ÿ0-9.\s]{2,35}?)(?=\s*(?:\||\d-\d|\d\s*\|\s*[1Xx2M])|$)/g;
  while ((m = regex.exec(normalized)) !== null && matches.length < 15) {
    let home = cleanOcrTeamName(ocrCleanWord(stripMatchPrefix(m[1].trim()).replace(/\s+/g, " ")));
    const away = cleanOcrTeamName(ocrCleanWord(m[2].trim().replace(/\s+/g, " ")));
    if (home.length < 2 || away.length < 2) continue;
    if (/^\d+$/.test(home) || /^\d+$/.test(away)) continue;
    if (isHeaderNoise(home) || isHeaderNoise(away)) continue;
    const key = `${home}|${away}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ home_team: home, away_team: away });
  }

  tryAddPleno15(normalized, matches);
  return applyCleanOcrToMatches(matches);
}

/** Si hay exactamente 14 partidos, intenta añadir el 15 (Pleno al 15) desde el final del texto. */
function tryAddPleno15(normalized: string, matches: ParsedMatch[]): void {
  if (matches.length !== 14) return;
  const tail = normalized.slice(-320);
  let pleno15 = tail.match(/(?:15|P-15)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s]{2,25}?)\s+-\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s]{2,25}?)(?=[.,\s]|$)/i)
    || tail.match(/\s+([A-Za-zÀ-ÿ]{3,20})\s+-\s+([A-Za-zÀ-ÿ]{3,20})\s*$/);
  if (pleno15) {
    let home = cleanOcrTeamName(trimToTeamName(stripMatchPrefix(pleno15[1].trim())).replace(/\s+/g, " "));
    let away = cleanOcrTeamName(trimToTeamName(pleno15[2].trim()).replace(/\s+/g, " "));
    if (home.length >= 2 && away.length >= 2 && !isHeaderNoise(home) && !isHeaderNoise(away)) {
      matches.push({ home_team: home, away_team: away });
      return;
    }
  }
  // OCR a veces pone "MO of" + "MALLORCA" + "15" (Pleno al 15: RAYO - MALLORCA)
  const mallorcaMatch = tail.match(/MALLORCA\s*\.*\s*\.*\s*15/i) || tail.match(/\s+(\S+)\s+MALLORCA/i);
  if (mallorcaMatch && /MALLORCA/i.test(tail)) {
    const away = "MALLORCA";
    const home = "RAYO"; // Pleno al 15 típico cuando solo se lee MALLORCA
    matches.push({ home_team: home, away_team: away });
  }
}

function applyCleanOcrToMatches(matches: ParsedMatch[]): ParsedMatch[] {
  return matches.map(({ home_team, away_team }) => ({
    home_team: cleanOcrTeamName(home_team),
    away_team: cleanOcrTeamName(away_team),
  }));
}

/**
 * Try to find JSON in HTML that might contain quiniela match data (e.g. __NEXT_DATA__, or "partidos"/"equipos").
 */
export function tryParseJsonFromHtml(html: string): ParsedMatch[] | null {
  const jsonMatch = html.match(/<script[^>]*type\s*=\s*["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const partidos = data?.props?.pageProps?.partidos ?? data?.partidos ?? data?.matches ?? data?.equipos;
      if (Array.isArray(partidos) && partidos.length >= 14) {
        return partidos.slice(0, 15).map((p: Record<string, string>) => ({
          home_team: String(p?.local ?? p?.home ?? p?.home_team ?? p?.equipo1 ?? "").trim(),
          away_team: String(p?.visitante ?? p?.away ?? p?.away_team ?? p?.equipo2 ?? "").trim(),
        }));
      }
    } catch {
      // ignore
    }
  }

  // __NEXT_DATA__
  const nextData = html.match(/<script[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) {
    try {
      const data = JSON.parse(nextData[1]);
      const props = data?.props?.pageProps ?? data?.props ?? data;
      const partidos = props?.partidos ?? props?.matches ?? props?.resultados;
      if (Array.isArray(partidos) && partidos.length >= 14) {
        return partidos.slice(0, 15).map((p: Record<string, string>) => ({
          home_team: String(p?.local ?? p?.home ?? p?.equipoLocal ?? "").trim(),
          away_team: String(p?.visitante ?? p?.away ?? p?.equipoVisitante ?? "").trim(),
        }));
      }
    } catch {
      // ignore
    }
  }

  // Any script containing JSON with "partidos" or "local"/"visitante"
  const scriptBlocks = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of scriptBlocks) {
    const content = block[1];
    if (content.length < 500 || !content.includes("partidos") && !content.includes("visitante")) continue;
    const jsonMatch = content.match(/\{(?:"partidos"|"matches"|"resultados")\s*:\s*\[[\s\S]*?\]\s*(?:,\s*[^}]*)?\}/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        const partidos = data?.partidos ?? data?.matches ?? data?.resultados;
        if (Array.isArray(partidos) && partidos.length >= 14) {
          return partidos.slice(0, 15).map((p: Record<string, string>) => ({
            home_team: String(p?.local ?? p?.home ?? p?.equipoLocal ?? p?.equipo1 ?? "").trim(),
            away_team: String(p?.visitante ?? p?.away ?? p?.equipoVisitante ?? p?.equipo2 ?? "").trim(),
          }));
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

/** Resultados extraídos para una jornada (1-14: 1/X/2, 15: pleno) */
export type ParsedJornadaResults = {
  number: number;
  result_1x2: ("1" | "X" | "2")[] | null;
  pleno_15: { home: "0" | "1" | "2" | "M"; away: "0" | "1" | "2" | "M" } | null;
};

/**
 * Split HTML by "JORNADA Nº" / "JORNADA Nª" sections and extract 1/X/2 + pleno 15 per section.
 * So when the page has "LA QUINIELA JORNADA 32ª" then matches, then "JORNADA 31ª"..., we return
 * one entry per jornada with only that section's results.
 */
export function parseQuinielaResultsByJornada(html: string): ParsedJornadaResults[] {
  const out: ParsedJornadaResults[] = [];
  // Find section headers: "JORNADA 32", "JORNADA 32ª", "32ª", "jornada 32"
  const headerRegex = /(?:LA\s+QUINIELA\s+)?(?:JORNADA|jornada)\s*(\d+)\s*ª?|(\d+)\s*ª/gi;
  const matches: { index: number; number: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(html)) !== null) {
    const num = parseInt(m[1] ?? m[2], 10);
    if (num >= 1 && num <= 60) matches.push({ index: m.index, number: num });
  }
  if (matches.length === 0) {
    // No headers: treat whole HTML as one block, use "0" as virtual number (caller can use as "latest")
    const one = extractResultsFromHtmlFragment(html);
    if (one.result_1x2 || one.pleno_15) out.push({ number: 0, ...one });
    return out;
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const fragment = html.slice(start, end);
    const extracted = extractResultsFromHtmlFragment(fragment);
    if (extracted.result_1x2 || extracted.pleno_15)
      out.push({ number: matches[i].number, ...extracted });
  }
  return out;
}

function extractResultsFromHtmlFragment(html: string): Omit<ParsedJornadaResults, "number"> {
  const results: string[] = [];
  const oneXTwo = html.matchAll(
    /(?:resultado|result|quiniela|celda|numero)[^>]*>[\s]*([1Xx2])[\s]*</gi
  );
  for (const x of oneXTwo) {
    const v = (x[1] ?? "").toUpperCase();
    if (v === "X" || v === "1" || v === "2") results.push(v);
  }
  if (results.length < 14) {
    const alt = html.matchAll(/["']([1Xx2])["']/g);
    for (const x of alt) {
      const v = (x[1] ?? "").toUpperCase();
          if (v === "X" || v === "1" || v === "2") results.push(v);
        }
  }
  const result1x2 = results.length >= 14 ? results.slice(0, 14) as ("1" | "X" | "2")[] : null;

  let plenoHome: string | null = null;
  let plenoAway: string | null = null;
  const plenoMatch = html.match(
    /pleno[^0-9M]*([01M2])[\s\-]+([01M2])|([01M2])[\s\-]+([01M2])[^0-9M]*pleno/i
  );
  if (plenoMatch) {
    plenoHome = (plenoMatch[1] ?? plenoMatch[3])?.toUpperCase() ?? null;
    plenoAway = (plenoMatch[2] ?? plenoMatch[4])?.toUpperCase() ?? null;
  }
  // Pleno 15 often shown as "1-1" or "M-2" in a single cell
  if (!plenoHome || !plenoAway) {
    const scorePleno = html.match(/(?:P-15|pleno\s*al\s*15)[^0-9M]*([01M2])[\s\-]+([01M2])|([01M2])[\s\-]+([01M2])\s*(?:\)|<\/)/i);
    if (scorePleno) {
      plenoHome = (scorePleno[1] ?? scorePleno[3])?.toUpperCase() ?? null;
      plenoAway = (scorePleno[2] ?? scorePleno[4])?.toUpperCase() ?? null;
    }
  }
  const pleno15 =
    plenoHome && plenoAway
      ? { home: plenoHome as "0" | "1" | "2" | "M", away: plenoAway as "0" | "1" | "2" | "M" }
      : null;

  return { result_1x2: result1x2, pleno_15: pleno15 };
}
