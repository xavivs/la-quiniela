/**
 * Parse OCR text from a Quiniela slip to extract up to 15 "HOME - AWAY" match pairs.
 * Handles lines like "1 GETAFE - R.SOCIEDAD", "GETAFE - R.SOCIEDAD", "2. GIRONA - OSASUNA".
 */
export type ParsedMatch = { home_team: string; away_team: string };

export function parseSlipOcrText(text: string): ParsedMatch[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const matches: ParsedMatch[] = [];

  for (const line of lines) {
    if (matches.length >= 15) break;

    const dashIndex = line.indexOf(" - ");
    if (dashIndex === -1) continue;

    let left = line.slice(0, dashIndex).trim();
    const right = line.slice(dashIndex + 3).trim();
    // Strip leading match number: "1 ", "2.", "15 "
    left = left.replace(/^\s*\d{1,2}[.\s]*/i, "").trim();

    if (left.length < 2 || right.length < 2) continue;
    if (/^\d+$/.test(left) || /^\d+$/.test(right)) continue;

    const home_team = left.replace(/\s+/g, " ");
    const away_team = right.replace(/\s+/g, " ");

    matches.push({ home_team, away_team });
  }

  return matches;
}
