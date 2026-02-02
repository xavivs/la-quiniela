export type UserRole = "user" | "admin" | "superadmin";

export type User = {
  id: string;
  email: string;
  quiniela_name: string | null;
  role?: UserRole;
  created_at?: string;
};

export type Jornada = {
  id: string;
  number: number;
  season: string;
  slip_image_url: string | null;
  is_historical?: boolean;
  created_at?: string;
};

export type QuinielaMatch = {
  id: string;
  jornada_id: string;
  match_order: number;
  home_team: string;
  away_team: string;
  result_1x2: "1" | "X" | "2" | null;
  result_home: "0" | "1" | "2" | "M" | null;
  result_away: "0" | "1" | "2" | "M" | null;
};

/** Used by admin MatchList (matches with date and real score). */
export type Match = {
  id: string;
  home_team: string;
  away_team: string;
  date: string;
  real_home_score?: number | null;
  real_away_score?: number | null;
};

export type QuinielaPrediction = {
  id: string;
  user_id: string;
  quiniela_match_id: string;
  predicted_1x2: "1" | "X" | "2" | null;
  predicted_home: "0" | "1" | "2" | "M" | null;
  predicted_away: "0" | "1" | "2" | "M" | null;
  created_at?: string;
};

export type RankingEntry = {
  user_id: string;
  quiniela_name: string;
  total_points: number;
};

export type Season = {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  archived_at?: string | null;
};

export type QuinielaPrize = {
  id: string;
  jornada_id: string;
  user_id: string;
  amount: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PointsHistoryEntry = {
  jornada_id: string;
  jornada_number: number;
  points_by_user: Record<string, number>;
};
