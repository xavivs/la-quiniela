import type { QuinielaMatch, QuinielaPrediction } from "./types";

/** 1 point per correct result (1-14: 1/X/2; match 15: exact pleno 0/1/2/M) */
export function pointsForPrediction(
  match: QuinielaMatch,
  pred: QuinielaPrediction
): number {
  if (match.match_order <= 14) {
    if (match.result_1x2 == null) return 0;
    return pred.predicted_1x2 === match.result_1x2 ? 1 : 0;
  }
  // Match 15: pleno al 15
  if (match.result_home == null || match.result_away == null) return 0;
  return pred.predicted_home === match.result_home &&
    pred.predicted_away === match.result_away
    ? 1
    : 0;
}

export function isCorrect(
  match: QuinielaMatch,
  pred: QuinielaPrediction
): boolean {
  return pointsForPrediction(match, pred) === 1;
}
