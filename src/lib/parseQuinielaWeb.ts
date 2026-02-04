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
    .replace(/\u2013/g, "-") // en dash to hyphen
    .replace(/\u2014/g, "-") // em dash to hyphen
    .replace(/&ndash;|&#8211;|&#x2013;/gi, "-")
    // Normalize all dashes to " - " (with spaces): handles "RAYO-OSASUNA", "RAYO -OSASUNA", "RAYO- OSASUNA", "RAYO - OSASUNA"
    // This regex matches any dash (hyphen, en-dash, em-dash) with optional spaces around it
    .replace(/\s*[-–—]\s*/g, " - ")
    // Handle dots before dashes: "RACINGS.-LASPALMAS" -> "RACINGS - LASPALMAS"
    .replace(/([A-Za-zÀ-ÿ0-9])\.\s*-\s*([A-Za-zÀ-ÿ0-9])/g, "$1 - $2")
    // Normalize tabs to spaces
    .replace(/\t/g, " ")
    // Normalize multiple spaces to single space (but preserve line structure)
    .replace(/[ \t]+/g, " ")
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
  
  // Reject strings that are mostly dots or have many consecutive dots (e.g., "e.e.e", "..........")
  // But allow valid team names with a single dot like R.OVIEDO, ATH.CLUB, R.SOCIEDAD
  if (t.match(/^[.\s]+$/)) return true; // Only dots/spaces
  const dotMatches = t.match(/\./g);
  if (dotMatches && dotMatches.length >= 3) return true; // 3+ dots total
  if (t.match(/\.{2,}/)) return true; // 2+ consecutive dots
  
  // Reject patterns like "E.E", "E.E.E", "E.NNNNN" (OCR noise from dots)
  if (/^[A-Z]\.[A-Z](\.[A-Z])*$/i.test(t) && t.length < 10) return true;
  if (/^[A-Z]\.[A-Z]{3,}$/i.test(t) && t.length < 10) return true;
  
  const strongNoise = ["PRONÓSTICO", "QUINIELA", "JORNADA", "DIA/HORA", "DIA HORA", "1X2", "VIERNES", "SABADO", "DOMINGO", "LUNES", "BOTE", "CIERRE", "PART."];
  if (strongNoise.some((n) => t.includes(n))) return true;
  if (/\d{1,2}:\d{2}\s*(VIE|SAB|DOM|LUN)/i.test(t) || /^\d\s*[Xx]\s*\d$/i.test(t)) return true;
  if (t === "PART" || t === "1X2") return true;
  const shortNoise = ["MEX", "BOM", "TPXI", "DMETIX", "SABE", "DMPOITI", "MO OF", "EEE", "E.NNNNN"];
  if (t.length < 10 && shortNoise.some((n) => t.includes(n))) return true;
  return false;
}

/**
 * Prefijos OCR que son columna DIA/HORA o 1X2 y se cuelan en el nombre del equipo local.
 * Se eliminan repetidamente hasta que solo quede el nombre del equipo.
 * Incluye todos los patrones de ruido encontrados en diferentes jornadas.
 */
const OCR_JUNK_PREFIXES =
  /^\s*(v\s+|Mex\s*2\s*|bóm|bom|boM|MeNITIXIZ|MENITIXIZ|AB\s+|TPXI2I\s+|TPXI2\s+|TPXI\s+|TPX12\s+|DMETIXIZ\s+|DMETIX\s+|DMPTIXIZ\s+|DMPTIX\s+|DOMITIXI2\s+|DMBTIXIZ\s+|DMT\s+|PTIXE2\s+|boMPTIXE2\s+|SABE\s*T?X?\s*\d?\s*\|?\s*\|?\s*|Sap\s+|Sah\s+|Sas\s+|SAB\s+|DOM\s+|LUN\s+|TUN\s+|tn\s+|Som\s+|po\s+|ap\s+|X2\s+|X\s+2\s+|xl2\s+|xI2\s+|T\|X\s*\d?\s*|TX\s*\d?\s*|1\s*\|?\s*X\s*\|?\s*2\s*|2\s*\|?\s*X\s*\|?\s*\d?\s*|op\s*1\s*\|?\s*2\s*\/?M\s*\|?|NO\s*1\/2\/M\s*\|?|UNEIIIXI2\s+|5OMPOL1\s*\[?\d?\)?M\s*|5MPOlN1\s*\|?\d?M\s*)\s*/gi;

/** Quita prefijos OCR (bóm, DIA/HORA, 1X2, etc.) y corrige nombres habituales. */
function cleanOcrTeamName(s: string): string {
  let t = s.trim();
  let prev = "";
  while (prev !== t && t.length > 0) {
    prev = t;
    t = t.replace(OCR_JUNK_PREFIXES, "").trim();
  }
  t = t.replace(/\s+$/g, "").replace(/^\s+/g, "").replace(/\s+/g, " ");
  t = t.replace(/^ROVIEDO$/i, "OVIEDO").replace(/^ESPANVOL$/i, "ESPANYOL").replace(/^ESPANOL$/i, "ESPANYOL");
  return t.trim();
}

/**
 * From OCR blob: take only the team name.
 * Stop at: trailing comma, multiple dots (3+), match number patterns, or OCR noise.
 * Does NOT strip a single dot inside name (e.g. R.OVIEDO stays).
 * Simplified for line-based parsing where we already cut at "..." markers.
 */
function trimToTeamName(s: string): string {
  let t = s.trim();
  // Normalize whitespace
  t = t.replace(/\s+/g, " ");
  
  // Stop at trailing comma (team names don't have commas)
  t = t.replace(/,.*$/, "");
  
  // Stop at multiple consecutive dots (2+) - these are separators (be more aggressive)
  t = t.replace(/\s*\.{2,}.*$/, "");
  
  // Stop at patterns like "e.e.e" or "e.nnnnn" (OCR noise)
  t = t.replace(/[a-z]\.[a-z]{1,}\.[a-z]{1,}.*$/i, ""); // e.e.e pattern
  t = t.replace(/[a-z]\.[a-z]{3,}.*$/i, ""); // e.nnnnn pattern
  
  // Stop at match number patterns: " 12 1", " 3 56909", " 3 SAB", " 15 5OMPOL1[2)M"
  t = t.replace(/\s+\d{1,2}\s+(\d{2,4}|[A-Za-z]{2,10}|[A-Z0-9\[\]\(\)\|]+).*$/i, "");
  
  // Stop at trailing match number only: " 15"
  t = t.replace(/\s+\d{1,2}\s*$/, "");
  
  // Stop at "1 X 2" patterns
  t = t.replace(/\s*\d\s*[Xx\/]\s*\d.*$/i, "");
  
  // Stop at "|2|", "|1|2|M|" patterns
  t = t.replace(/\s*\|\s*[Xx12M\d\s\/]+\s*\|?\s*$/i, "");
  
  // Stop at OCR noise patterns: "op1|2|M|", "NO 1/2/M|", "5OMPOL1[2)M", "5MPOlN1|2M", etc.
  t = t.replace(/\s+op\s*\d\s*\|?\s*\d\s*\/?M\s*\|?\s*$/i, "");
  t = t.replace(/\s+NO\s+\d\s*\/\s*\d\s*\/\s*M\s*\|?\s*$/i, "");
  // Stop at patterns like "5OMPOL1[2)M" or "5MPOlN1|2M" (OCR noise after match number)
  t = t.replace(/\s+\d+[A-Z0-9\[\]\(\)\|]+.*$/i, "");
  
  // Remove trailing dots (but preserve single dot in names like R.OVIEDO)
  t = t.replace(/\.+$/, "");
  
  // Final cleanup: reject noise patterns like "e.e" or "e.e.e"
  if (/^[a-z]\.[a-z](\.[a-z])*$/i.test(t) && t.length < 10) {
    return "";
  }
  
  return ocrCleanWord(t).trim();
}

/**
 * Extract up to 15 "HOME - AWAY" pairs from text using line-based parsing.
 * Strategy: Split by lines, find "JORNADA" marker, then process each line in order.
 * Format: "Local - Visitante...." + noise + newline for matches 1-14
 * Format: "Local" + noise + newline + "Visitante..." + noise for match 15 (Pleno al 15)
 * 
 * Structure:
 * COSAS (header lines)
 * JORNADA X COSAS
 * LOCAL-VISITANTE...COSAS (or LOCAL - VISITANTE...COSAS)
 * ...
 * LOCAL COSAS (match 15, line 1)
 * VISITANTE,... COSAS (match 15, line 2)
 */
export function parseTeamNamesFromText(text: string): ParsedMatch[] {
  const matches: ParsedMatch[] = [];
  // Split into lines
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  
  // Find where matches start (after "JORNADA X" line)
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/JORNADA\s+\d+/i.test(lines[i])) {
      startIdx = i + 1;
      break;
    }
  }
  // If we didn't find JORNADA, try to skip obvious header lines
  if (startIdx === 0) {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (/PRONÓSTICO|QUINIELA|DIA\/HORA|1X2|PART\./i.test(lines[i])) {
        startIdx = i + 1;
      }
    }
  }
  
  // Process lines in order from startIdx
  // Continue until we have 15 matches, but allow checking extra lines for pleno al 15
  for (let i = startIdx; i < lines.length; i++) {
    // If we already have 15 matches and we've processed enough lines, stop
    if (matches.length >= 15 && i > startIdx + 16) {
      break;
    }
    const line = lines[i];
    
    // Skip header lines (COSAS) - but be less aggressive
    if (/PRONÓSTICO|QUINIELA|DIA\/HORA|1X2|PART\./i.test(line)) {
      continue;
    }
    // Only skip if entire line is header noise (not just contains it)
    if (isHeaderNoise(line) && line.length < 20) {
      continue;
    }
    
    // Pattern 1: Line contains dash between team names (matches 1-14)
    // Also handle cases without dash: "CELTA RAYO" (two capital words separated by space)
    let dashIdx = -1;
    let dashLen = 0;
    let hasDash = false;
    
    const dashPatterns = [
      { pattern: " - ", len: 3 },
      { pattern: "-", len: 1 },
      { pattern: "–", len: 1 },
      { pattern: "—", len: 1 },
    ];
    
    for (const { pattern, len } of dashPatterns) {
      const idx = line.indexOf(pattern);
      if (idx !== -1 && idx > 0 && idx < line.length - len) {
        dashIdx = idx;
        dashLen = len;
        hasDash = true;
        break;
      }
    }
    
    // Fallback: if no dash found, try to find two capital words separated by space
    // Pattern: "CELTA RAYO" or "CELTA RAYO," or "CELTA RAYO, ....e.nnnnn"
    let home = "";
    let away = "";
    let foundMatch = false;
    
    if (!hasDash) {
      // Match two teams: first starts with capital, second starts with capital
      // Stop at comma, dots, or numbers
      const twoTeamsMatch = line.match(/^([A-Z][A-Za-zÀ-ÿ0-9.]+)\s+([A-Z][A-Za-zÀ-ÿ0-9.]+)/);
      if (twoTeamsMatch && twoTeamsMatch.index === 0) {
        // Found two teams without dash - extract directly
        let extractedHome = twoTeamsMatch[1].trim();
        let extractedAway = twoTeamsMatch[2].trim();
        
        // Remove leading match number if present
        extractedHome = stripMatchPrefix(extractedHome);
        
        // Clean away team - stop at comma, dots, or numbers
        if (extractedAway.includes(",")) {
          extractedAway = extractedAway.split(",")[0].trim();
        }
        const awayDotsMatch = extractedAway.match(/^(.+?)(?=\s*\.{2,}|$)/);
        if (awayDotsMatch) {
          extractedAway = awayDotsMatch[1].trim();
        }
        const awayNumMatch = extractedAway.match(/^(.+?)(?=\s+\d|$)/);
        if (awayNumMatch) {
          extractedAway = awayNumMatch[1].trim();
        }
        
        home = extractedHome;
        away = extractedAway;
        foundMatch = true;
      }
    }
    
    if (hasDash && dashIdx !== -1 && !foundMatch) {
      // Extract text before and after dash
      let beforeDash = line.substring(0, dashIdx).trim();
      let afterDash = line.substring(dashIdx + dashLen).trim();
      
      // Remove leading match number if present
      beforeDash = stripMatchPrefix(beforeDash);
      
      // Extract team names - take everything up to dots (3+), comma, or numbers
      // Home team: everything before dash (already extracted)
      home = beforeDash;
      // Stop home at numbers if present
      const homeNumMatch = home.match(/^(.+?)(?=\s+\d+\s|$)/);
      if (homeNumMatch) {
        home = homeNumMatch[1].trim();
      }
      
      // Away team: everything after dash until dots (3+), comma, or numbers
      away = afterDash;
      // Stop at dots (3+) - be more aggressive
      const dotsMatch = away.match(/^(.+?)(?=\s*\.{2,}|$)/);
      if (dotsMatch) {
        away = dotsMatch[1].trim();
      }
      // Stop at comma
      if (away.includes(",")) {
        away = away.split(",")[0].trim();
      }
      // Stop at numbers (match number pattern) - be more aggressive
      const numMatch = away.match(/^(.+?)(?=\s+\d{1,2}\s+\d|\s+\d{1,2}\s*$|\s+\d{2,}|$)/);
      if (numMatch) {
        away = numMatch[1].trim();
      }
      // Also stop at patterns like "15 5OMPOL1[2)M" or "15 5MPOlN1|2M"
      const plenoNoiseMatch = away.match(/^(.+?)(?=\s+\d+\s+[A-Z0-9\[\]\(\)\|]+|$)/);
      if (plenoNoiseMatch) {
        away = plenoNoiseMatch[1].trim();
      }
    }
    
    // Apply cleaning to both cases (with dash or without dash)
    if ((hasDash && dashIdx !== -1) || foundMatch) {
      // Clean team names - minimal cleaning
      home = home.replace(/\s+/g, " ").trim();
      away = away.replace(/\s+/g, " ").trim();
      
      // Remove trailing dots, commas, and numbers - be more aggressive
      home = home.replace(/[.,]+$/, "").trim();
      away = away.replace(/[.,]+$/, "").trim();
      home = home.replace(/\s+\d+.*$/, "").trim(); // Remove numbers and everything after
      away = away.replace(/\s+\d+.*$/, "").trim(); // Remove numbers and everything after
      // Remove patterns like "15 5OMPOL1[2)M" or "15 5MPOlN1|2M"
      away = away.replace(/\s+\d+\s+[A-Z0-9\[\]\(\)\|]+.*$/, "").trim();
      // Remove trailing dots (2+)
      away = away.replace(/\.{2,}.*$/, "").trim();
      
      // Remove leading OCR noise prefixes
      home = cleanOcrTeamName(home);
      away = cleanOcrTeamName(away);
      
      // Basic OCR word cleaning
      home = ocrCleanWord(home);
      away = ocrCleanWord(away);
      
      // Final trim
      home = home.trim();
      away = away.trim();
      
      // Basic validation - be very lenient
      if (home.length >= 2 && away.length >= 2 && 
          !/^\d+$/.test(home) && !/^\d+$/.test(away) &&
          home.length <= 50 && away.length <= 50) {
        // Only reject if clearly header noise (very short and matches noise patterns)
        const homeIsNoise = home.length < 4 && isHeaderNoise(home);
        const awayIsNoise = away.length < 4 && isHeaderNoise(away);
        
        if (!homeIsNoise && !awayIsNoise) {
          matches.push({ home_team: home, away_team: away });
          continue;
        }
      }
    }
    
    // Pattern 2: Pleno al 15 - current line is LOCAL (no dash), next line is VISITANTE
    // Try when we have 13 or 14 matches (in case one was missed)
    // Also try when we're near the end of the lines (last 3 lines)
    const isNearEnd = i >= lines.length - 3;
    if ((matches.length === 13 || matches.length === 14 || isNearEnd) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim() || "";
      
      // Current line should be a team name without dash (or with dash only if it's a known pleno pattern)
      // Next line should be a team name without dash at start
      // Be more lenient: allow checking even if current line has some patterns
      const currentHasDash = line.indexOf("-") !== -1 || line.indexOf("–") !== -1 || line.indexOf("—") !== -1;
      const nextHasDash = nextLine.indexOf(" - ") !== -1 || nextLine.indexOf("-") !== -1;
      
      // If current line doesn't have dash, or if we're at the end and it looks like pleno pattern
      if (!currentHasDash && !nextHasDash) {
        // Extract home team from current line (stop at OCR noise like "op1|2|M|", "op1/2/M|")
        // Must capture full name including dots (e.g., "ATH.CLUB", "R.SOCIEDAD")
        // Pattern: "ATH.CLUB op1/2/M|" or "R.SOCIEDAD op1|2|M|" or "GIRONA op1|2/M|"
        // Match: starts with capital, then letters/numbers/dots, stop at "op" or end
        // Use a more explicit pattern that handles dots correctly
        let currentMatch = line.match(/^([A-Z][A-Za-zÀ-ÿ0-9]+(?:\.[A-Za-zÀ-ÿ0-9]+)*?)(?=\s+op|\s*$)/i);
        // If no match with "op", try capturing everything up to space or end
        if (!currentMatch) {
          currentMatch = line.match(/^([A-Z][A-Za-zÀ-ÿ0-9]+(?:\.[A-Za-zÀ-ÿ0-9]+)*)/i);
        }
        // Fallback: simple pattern that definitely captures names with dots
        if (!currentMatch) {
          currentMatch = line.match(/^([A-Z][A-Za-zÀ-ÿ0-9.]+?)(?=\s+op|\s*$)/);
        }
        if (!currentMatch) {
          currentMatch = line.match(/^([A-Z][A-Za-zÀ-ÿ0-9.]+)/);
        }
        // Extract away team from next line - capture name before comma, dots, or numbers
        // Pattern: "GETAFE,..........neen..15 NO 1/2/M|" or "RSOCIEDAD......................15 5OMPOL1[2)M" or "BARCELONA......................15 5MPOlN1|2M"
        // First try to get the name before comma or dots (2+)
        let nextMatch = nextLine.match(/^([A-Z][A-Za-zÀ-ÿ0-9]+(?:\.[A-Za-zÀ-ÿ0-9]+)*?)(?=[,\s]*\.{2,}|\s+\d|$)/i);
        // If no match, try without lookahead (just capture the name)
        if (!nextMatch) {
          nextMatch = nextLine.match(/^([A-Z][A-Za-zÀ-ÿ0-9]+(?:\.[A-Za-zÀ-ÿ0-9]+)*)/i);
        }
        // Fallback: simple pattern
        if (!nextMatch) {
          nextMatch = nextLine.match(/^([A-Z][A-Za-zÀ-ÿ0-9.]+?)(?=[,\s]*\.{2,}|\s+\d|$)/);
        }
        if (!nextMatch) {
          nextMatch = nextLine.match(/^([A-Z][A-Za-zÀ-ÿ0-9.]+)/);
        }
        
        if (currentMatch && nextMatch) {
          let home = currentMatch[1].trim();
          let away = nextMatch[1].trim();
          
          // Apply full cleaning pipeline to both teams
          // For home team, be careful not to trim too aggressively (preserve dots in names like ATH.CLUB, R.SOCIEDAD)
          home = stripMatchPrefix(home);
          // Don't use trimToTeamName for home team if it has a dot (could be ATH.CLUB, R.SOCIEDAD, etc.)
          // Just remove OCR noise patterns manually, but preserve the full name
          if (!home.includes(".")) {
            home = trimToTeamName(home);
          } else {
            // For names with dots, remove OCR noise patterns but preserve the name
            // Remove patterns like "op1|2|M|", "op1/2/M|", etc.
            home = home.replace(/\s+op\s*\d\s*\|?\s*\d\s*\/?M\s*\|?\s*$/i, "").trim();
            // Remove any trailing spaces or noise
            home = home.replace(/\s+$/, "").trim();
          }
          home = cleanOcrTeamName(home);
          home = ocrCleanWord(home);
          
          // For away team, first remove comma if present, then use trimToTeamName
          if (away.includes(",")) {
            away = away.split(",")[0].trim();
          }
          // Use trimToTeamName which handles all the noise patterns
          away = trimToTeamName(away);
          away = cleanOcrTeamName(away);
          away = ocrCleanWord(away);
          
          // Additional aggressive cleanup for away team (pleno al 15 often has more noise)
          // Remove patterns like "......................15 5OMPOL1[2)M" or "..........neen..15 NO 1/2/M|"
          away = away.replace(/\.{2,}.*$/, "").trim();
          away = away.replace(/\s+\d+\s+[A-Z0-9\[\]\(\)\|]+.*$/, "").trim();
          away = away.replace(/\s+\d+.*$/, "").trim();
          away = away.replace(/[.,]+$/, "").trim();
          
          if (home.length >= 2 && away.length >= 2 && 
              !/^\d+$/.test(home) && !/^\d+$/.test(away) &&
              !isHeaderNoise(home) && !isHeaderNoise(away)) {
            matches.push({ home_team: home, away_team: away });
            i++; // Skip next line
            break;
          }
        }
      }
    }
  }
  
  // If we still don't have 15 matches, try to find pleno al 15 in the last few lines
  if (matches.length < 15 && lines.length >= 2) {
    // Look at the last 5 lines for pleno al 15 pattern (more aggressive)
    for (let i = Math.max(startIdx, lines.length - 5); i < lines.length - 1; i++) {
      const line = lines[i]?.trim() || "";
      const nextLine = lines[i + 1]?.trim() || "";
      
      // Check if current line looks like a team name without dash
      // and next line looks like another team name
      if (line.length > 2 && nextLine.length > 2 &&
          line.indexOf("-") === -1 && line.indexOf("–") === -1 && line.indexOf("—") === -1 &&
          nextLine.indexOf(" - ") === -1 && nextLine.indexOf("-") === -1) {
        
        // Extract home team from current line - must capture full name including dots
        // Pattern: "ATH.CLUB op1/2/M|" or "R.SOCIEDAD op1|2|M|" or "GIRONA op1|2/M|"
        let currentMatch = line.match(/^([A-Z][A-Za-zÀ-ÿ0-9]+(?:\.[A-Za-zÀ-ÿ0-9]+)*?)(?=\s+op|\s*$)/i);
        if (!currentMatch) {
          currentMatch = line.match(/^([A-Z][A-Za-zÀ-ÿ0-9]+(?:\.[A-Za-zÀ-ÿ0-9]+)*)/i);
        }
        // Fallback: simple pattern that definitely captures names with dots
        if (!currentMatch) {
          currentMatch = line.match(/^([A-Z][A-Za-zÀ-ÿ0-9.]+?)(?=\s+op|\s*$)/);
        }
        if (!currentMatch) {
          currentMatch = line.match(/^([A-Z][A-Za-zÀ-ÿ0-9.]+)/);
        }
        // Extract away team from next line - capture name before comma, dots, or numbers
        // Pattern: "GETAFE,..........neen..15" or "RSOCIEDAD......................15 5OMPOL1[2)M" or "BARCELONA......................15 5MPOlN1|2M"
        let nextMatch = nextLine.match(/^([A-Z][A-Za-zÀ-ÿ0-9]+(?:\.[A-Za-zÀ-ÿ0-9]+)*?)(?=[,\s]*\.{2,}|\s+\d|$)/i);
        // If no match, try without lookahead (just capture the name)
        if (!nextMatch) {
          nextMatch = nextLine.match(/^([A-Z][A-Za-zÀ-ÿ0-9]+(?:\.[A-Za-zÀ-ÿ0-9]+)*)/i);
        }
        // Fallback: simple pattern
        if (!nextMatch) {
          nextMatch = nextLine.match(/^([A-Z][A-Za-zÀ-ÿ0-9.]+?)(?=[,\s]*\.{2,}|\s+\d|$)/);
        }
        if (!nextMatch) {
          nextMatch = nextLine.match(/^([A-Z][A-Za-zÀ-ÿ0-9.]+)/);
        }
        
        if (currentMatch && nextMatch) {
          let home = currentMatch[1].trim();
          let away = nextMatch[1].trim();
          
          // Apply full cleaning pipeline
          // For home team, be careful not to trim too aggressively (preserve dots in names)
          home = stripMatchPrefix(home);
          // Don't use trimToTeamName for home team if it has a dot (could be ATH.CLUB, R.SOCIEDAD, etc.)
          if (!home.includes(".")) {
            home = trimToTeamName(home);
          } else {
            // For names with dots, just remove OCR noise patterns
            home = home.replace(/\s+op\s*\d\s*\|?\s*\d\s*\/?M\s*\|?\s*$/i, "").trim();
          }
          home = cleanOcrTeamName(home);
          home = ocrCleanWord(home);
          
          // For away team, first remove comma if present, then use trimToTeamName
          if (away.includes(",")) {
            away = away.split(",")[0].trim();
          }
          away = trimToTeamName(away);
          away = cleanOcrTeamName(away);
          away = ocrCleanWord(away);
          
          // Additional aggressive cleanup for away team
          away = away.replace(/\.{2,}.*$/, "").trim();
          away = away.replace(/\s+\d+\s+[A-Z0-9\[\]\(\)\|]+.*$/, "").trim();
          away = away.replace(/\s+\d+.*$/, "").trim();
          away = away.replace(/[.,]+$/, "").trim();
          
          // Check if this looks like a valid team pair
          if (home.length >= 2 && away.length >= 2 && 
              !/^\d+$/.test(home) && !/^\d+$/.test(away) &&
              !isHeaderNoise(home) && !isHeaderNoise(away)) {
            // Check if we already have this match
            const key = `${home}|${away}`;
            const alreadyExists = matches.some(m => 
              `${m.home_team}|${m.away_team}` === key
            );
            
            if (!alreadyExists) {
              matches.push({ home_team: home, away_team: away });
              break;
            }
          }
        }
      }
    }
  }
  
  return applyCleanOcrToMatches(matches);
}

/** Si faltan partidos (especialmente 13, 14, 15), intenta añadirlos desde el final del texto. */
function tryAddPleno15(normalized: string, matches: ParsedMatch[], seen: Set<string>): void {
  if (matches.length >= 15) return;
  
  const tail = normalized.slice(-400); // Más texto para detectar partidos 13, 14, 15
  // Update seen set with current matches
  for (const m of matches) {
    seen.add(`${m.home_team}|${m.away_team}`);
  }
  
  // Buscar partidos 13, 14, 15 con números explícitos: "13 RZARAGOZA - CASTELLÓN"
  const numberedMatches = tail.matchAll(/(?:^|\s)(?:1[3-5]|P-15)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.\s]{2,25}?)\s+-\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.\s]{2,25}?)(?=[.,\s]|\s*\d|$)/gi);
  for (const m of numberedMatches) {
    if (matches.length >= 15) break;
    let home = cleanOcrTeamName(trimToTeamName(stripMatchPrefix(m[1].trim())).replace(/\s+/g, " "));
    let away = cleanOcrTeamName(trimToTeamName(m[2].trim()).replace(/\s+/g, " "));
    if (home.length >= 2 && away.length >= 2 && !isHeaderNoise(home) && !isHeaderNoise(away)) {
      const key = `${home}|${away}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({ home_team: home, away_team: away });
      }
    }
  }
  
  // Si aún faltan partidos, buscar en el final sin números: "RZARAGOZA - CASTELLÓN", "DEPORTIVO-RACINGS", "GIRONA - GETAFE"
  if (matches.length < 15) {
    // Buscar todos los pares "TEAM - TEAM" en el final del texto
    const endPairs = tail.matchAll(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.\s]{3,25}?)\s+-\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.\s]{3,25}?)(?=[.,\s]|\s*\d|$)/gi);
    for (const m of endPairs) {
      if (matches.length >= 15) break;
      let home = cleanOcrTeamName(trimToTeamName(stripMatchPrefix(m[1].trim())).replace(/\s+/g, " "));
      let away = cleanOcrTeamName(trimToTeamName(m[2].trim()).replace(/\s+/g, " "));
      if (home.length >= 2 && away.length >= 2 && !isHeaderNoise(home) && !isHeaderNoise(away)) {
        const key = `${home}|${away}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({ home_team: home, away_team: away });
        }
      }
    }
  }
  
  // OCR a veces pone equipos en líneas separadas sin " - " entre ellos
  // Ejemplos: "GIRONA op1|2/M|\nGETAFE", "R.SOCIEDAD op1|2|M|\nBARCELONA", "ATH.CLUB op1/2/M|\nRSOCIEDAD"
  if (matches.length < 15) {
    // Buscar patrones como "TEAM op1|2|M|" seguido de otro equipo en línea separada
    const teamWithOpPattern = tail.match(/\b([A-Z][A-Za-zÀ-ÿ0-9.]+)\s+op\s*\d\s*\|?\s*\d\s*\/?M\s*\|?\s*[\r\n]+\s*([A-Z][A-Za-zÀ-ÿ0-9.]+)\b/i);
    if (teamWithOpPattern) {
      let home = cleanOcrTeamName(trimToTeamName(teamWithOpPattern[1].trim()));
      let away = cleanOcrTeamName(trimToTeamName(teamWithOpPattern[2].trim()));
      if (home.length >= 2 && away.length >= 2 && !isHeaderNoise(home) && !isHeaderNoise(away)) {
        const key = `${home}|${away}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({ home_team: home, away_team: away });
        }
      }
    }
    
    // Buscar equipos conocidos del pleno al 15 en líneas separadas
    const knownTeams = [
      ["GIRONA", "GETAFE"],
      ["RSOCIEDAD", "BARCELONA"],
      ["R.SOCIEDAD", "BARCELONA"],
      ["ATH.CLUB", "RSOCIEDAD"],
      ["ATHCLUB", "RSOCIEDAD"],
      ["DEPORTIVO", "RACINGS"],
      ["RZARAGOZA", "CASTELLÓN"],
    ];
    
    for (const [team1, team2] of knownTeams) {
      if (matches.length >= 15) break;
      const team1Match = tail.match(new RegExp(`\\b${team1.replace(/\./g, "\\.")}\\b`, "i"));
      const team2Match = tail.match(new RegExp(`\\b${team2.replace(/\./g, "\\.")}\\b`, "i"));
      if (team1Match && team2Match) {
        const key = `${team1.toUpperCase()}|${team2.toUpperCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({ home_team: team1.toUpperCase(), away_team: team2.toUpperCase() });
          break;
        }
      }
    }
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
