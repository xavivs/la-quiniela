// Fixed order for display (Semana + Ranking)
export const QUINIELA_NAMES = [
  "Xavi",
  "Laura",
  "Montse",
  "Lluís",
  "Jordi",
  "Neus",
  "Denci",
  "Marià",
] as const;

export type QuinielaName = (typeof QUINIELA_NAMES)[number];

export const OPTIONS_1X2 = ["1", "X", "2"] as const;
export const OPTIONS_PLENO = ["0", "1", "2", "M"] as const;
