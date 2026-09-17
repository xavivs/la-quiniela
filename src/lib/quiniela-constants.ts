// Full historical roster (including players who no longer compete)
export const QUINIELA_NAMES_ALL = [
  "Xavi",
  "Laura",
  "Montse",
  "Lluís",
  "Jordi",
  "Neus",
  "Denci",
  "Marià",
] as const;

// Current and future seasons: Denci stopped playing
export const QUINIELA_ACTIVE_NAMES = [
  "Xavi",
  "Laura",
  "Montse",
  "Lluís",
  "Jordi",
  "Neus",
  "Marià",
] as const;

/** Default roster for the active season and new seasons. */
export const QUINIELA_NAMES = QUINIELA_ACTIVE_NAMES;

export type QuinielaName = (typeof QUINIELA_NAMES_ALL)[number];
export type QuinielaActiveName = (typeof QUINIELA_ACTIVE_NAMES)[number];

/** Seasons in which Denci still played. Later seasons use the reduced roster. */
export function getQuinielaNamesForSeason(seasonName: string): readonly string[] {
  if (seasonName === "25-26" || seasonName.startsWith("Mundial 2026")) {
    return QUINIELA_NAMES_ALL;
  }
  return QUINIELA_ACTIVE_NAMES;
}

export const OPTIONS_1X2 = ["1", "X", "2"] as const;
export const OPTIONS_PLENO = ["0", "1", "2", "M"] as const;
