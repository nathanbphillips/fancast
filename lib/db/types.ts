/** Row types for the Phase 2 tables (db/migrations/0001). */

export type Role = "listener" | "commentator" | "admin";

/** Fixed platform set for commentator social links (FR-18.5). */
export type SocialPlatform =
  | "x"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "twitch"
  | "website";

export type Profile = {
  user_id: string;
  username: string;
  role: Role;
  avatar_url: string | null;
  standing: "good" | "restricted";
  theme_pref: "dark" | "light" | null;
  username_changed_at: string | null;
  created_at: string;
  // Commentator Platform Epic (migration 0026, FR-18)
  about: string | null;
  social_links: Partial<Record<SocialPlatform, string>> | null;
  commentator_terms_accepted_at: string | null;
  commentator_terms_version: string | null;
};

export type Follow = {
  follower_id: string;
  commentator_id: string;
  created_at: string;
};

export type Fixture = {
  id: number;
  /** the real Sportmonks fixture id for upstream calls; null for an admin game
   *  not yet matched (or one in a competition the plan doesn't cover). */
  sportmonks_fixture_id: number | null;
  source: "sportmonks" | "admin";
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
  | "wrapped"
  // FR-19.7 (migration 0027): host cancel / no-show expiry / admin suspend
  | "canceled";

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
  /** weighted vote score (Phase 11): established voters count full, new ones
   *  less; raw up/down stay for display, this drives the "top" sort. */
  score: number;
  flag_weight: number;
  /** thread spine (Phase 11): parent message id (null = top-level message), the
   *  top-level ancestor (= own id for a root), and nesting depth (0 = root). */
  parent_id: string | null;
  root_id: string;
  depth: number;
  /** inline link preview (founder 2026-06-29): a URL in the body is unfurled on
   *  send into these fields and rendered as a card. null when there's no link. */
  link_url: string | null;
  link_title: string | null;
  link_description: string | null;
  link_image: string | null;
  link_domain: string | null;
  created_at: string;
  /** embedded author (select alias author:profiles(...)) */
  author?: Pick<Profile, "username" | "role" | "avatar_url">;
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
  /** weighted vote score (Phase 11), drives the "top" sort. */
  score: number;
  created_at: string;
  author?: Pick<Profile, "username" | "role" | "avatar_url">;
};

export type Question = {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  status: "new" | "acknowledged" | "dismissed";
  created_at: string;
  author?: Pick<Profile, "username" | "role" | "avatar_url">;
};

export type TalkRequest = {
  id: string;
  room_id: string;
  user_id: string;
  topic: string;
  status: "pending" | "accepted" | "dismissed" | "completed";
  consent_at: string;
  created_at: string;
  author?: Pick<Profile, "username" | "role" | "avatar_url">;
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

/** The room's latest poll + live tallies (FR-12.2). null = no poll yet. The
 *  question/options/status are public; individual votes stay private. */
export type PollState = {
  id: string;
  question: string;
  options: string[];
  status: "open" | "closed";
  /** vote count per option index, aligned to `options` */
  results: number[];
  total: number;
} | null;

export type MyPollVote = { pollId: string; optionIdx: number } | null;

/** Player ratings (FR-12.3, postgame). Per-player average rides the control
 *  channel; individual ratings stay private. */
export type RatingsAggregate = { playerId: number; avg: number; count: number }[];
export type MyRatings = Record<number, number>;
/** A rateable player, derived from the lineup in the stats payload. */
export type RatingPlayer = {
  playerId: number;
  name: string;
  side: "home" | "away";
  starter: boolean;
};

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
  // Commentator Platform Epic (migration 0027, FR-19)
  /** immutable human URL: {home}-vs-{away}-{dd-mmm-yyyy}-{creator} */
  slug: string;
  /** host's one-line angle on the game (max 140) */
  blurb: string | null;
  /** fixture postponed upstream with no new date; drops from date listings */
  postponed: boolean;
};

/** room_hosts row (migration 0027): equal hosts, no primary (FR-19.4/FR-25). */
export type RoomHost = {
  room_id: string;
  user_id: string;
  status: "invited" | "accepted" | "declined" | "left";
  invited_by: string | null;
  created_at: string;
  responded_at: string | null;
};
