/** Row types for the Phase 2 tables (db/migrations/0001). */

export type Role = "listener" | "commentator" | "admin";

export type Profile = {
  user_id: string;
  username: string;
  role: Role;
  avatar_url: string | null;
  standing: "good" | "restricted";
  theme_pref: "dark" | "light" | null;
  username_changed_at: string | null;
  created_at: string;
};

export type Follow = {
  follower_id: string;
  commentator_id: string;
  created_at: string;
};

export type Fixture = {
  id: number;
  league_id: number | null;
  season: number | null;
  competition: string;
  round: string | null;
  home_team: string;
  away_team: string;
  home_team_id: number | null;
  away_team_id: number | null;
  kickoff_utc: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  updated_at: string;
};

export type RoomState =
  | "scheduled"
  | "waiting"
  | "pregame"
  | "live_1h"
  | "halftime"
  | "live_2h"
  | "extra_time"
  | "postgame"
  | "wrapped";

export type ChatMessage = {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  is_waiting_room: boolean;
  hidden_by: "flags" | "commentator" | "admin" | null;
  hidden_at: string | null;
  up_count: number;
  down_count: number;
  flag_weight: number;
  created_at: string;
  /** embedded author (select alias author:profiles(...)) */
  author?: Pick<Profile, "username" | "role">;
};

export type Link = {
  id: string;
  room_id: string;
  user_id: string;
  url: string;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  domain: string;
  hidden: boolean;
  up_count: number;
  down_count: number;
  created_at: string;
  author?: Pick<Profile, "username" | "role">;
};

export type Question = {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  status: "new" | "acknowledged" | "dismissed";
  created_at: string;
  author?: Pick<Profile, "username" | "role">;
};

export type TalkRequest = {
  id: string;
  room_id: string;
  user_id: string;
  topic: string;
  status: "pending" | "accepted" | "dismissed" | "completed";
  consent_at: string;
  created_at: string;
  author?: Pick<Profile, "username" | "role">;
  /** commentator-only: prior flags on this caller (lib/callers.ts) */
  caller_flags?: {
    count: number;
    notes: { note: string | null; by: string; at: string }[];
  };
};

export type SliderAggregate = {
  avg: number;
  count: number;
};

/** Score-predictor distribution (FR-12.1). Individual scorelines stay private;
 *  only the public distribution rides the control channel. */
export type PredictionAggregate = {
  total: number;
  /** most-predicted scorelines, highest first */
  top: { label: string; count: number }[];
};

export type MyPrediction = { home: number; away: number } | null;

export type Room = {
  id: string;
  fixture_id: number;
  commentator_id: string;
  state: RoomState;
  scheduled_kickoff: string;
  /** commentator-set planned start; waiting-room countdown targets this */
  broadcast_start: string | null;
  /** early access during waiting (founder decision 2026-06-11) */
  chat_open: boolean;
  links_open: boolean;
  /** radio mode (FR-5.3): live HLS playlist; null until egress starts */
  hls_url: string | null;
  hls_egress_id: string | null;
  opened_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  livekit_room: string | null;
  created_at: string;
};
