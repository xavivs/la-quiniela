/**
 * Placeholder for fetching real match results from an external football API.
 * Replace the implementation with your chosen API (e.g. API-Football, Football-Data.org).
 *
 * Expected: return array of { matchId: string, homeScore: number, awayScore: number }
 * You can match by (home_team, away_team, date) or store external_id on matches.
 */

export type FetchedResult = {
  matchId: string;
  homeScore: number;
  awayScore: number;
};

export async function fetchMatchResults(): Promise<FetchedResult[]> {
  // TODO: Connect to your football API
  // Example: const res = await fetch('https://api.example.com/fixtures', { headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY } });
  // Parse response and map to FetchedResult[] (matchId = your match id or external id)
  return [];
}
