/**
 * Scoring: 3 pts exact score, 1 pt correct winner/draw, 0 otherwise
 */
export function getPredictionPoints(
  predictedHome: number,
  predictedAway: number,
  realHome: number | null,
  realAway: number | null
): number {
  if (realHome === null || realAway === null) return 0;

  const exact =
    predictedHome === realHome && predictedAway === realAway;
  if (exact) return 3;

  const predWinner =
    predictedHome > predictedAway ? "home" : predictedHome < predictedAway ? "away" : "draw";
  const realWinner =
    realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";
  if (predWinner === realWinner) return 1;

  return 0;
}
