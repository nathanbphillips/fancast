/**
 * Point the existing "Arsenal vs Chelsea" room at the real 2026-03-01 fixture
 * (Arsenal 2-1 Chelsea, id 19427155) so the live stats panel shows real data.
 * Reversible. npx tsx --env-file=.env.local scripts/ac-demo.ts on|off
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ROOM = "4faca2cf-1bba-4912-bafa-fd19a66f364a"; // nathan's Arsenal v Chelsea pregame room
const FIXTURE = 19427155;

async function on() {
  await service.from("fixtures").upsert({
    id: FIXTURE, league_id: 8, season: 2026, competition: "Premier League", round: "27",
    home_team: "Arsenal", away_team: "Chelsea", home_team_id: 19, away_team_id: 18,
    kickoff_utc: "2026-03-01T16:30:00+00:00", status: "FT", home_score: 2, away_score: 1,
    updated_at: new Date().toISOString(),
  });
  await service.from("rooms").update({ fixture_id: FIXTURE }).eq("id", ROOM);
  console.log(`room ${ROOM} now points at real fixture ${FIXTURE} (Arsenal 2-1 Chelsea)`);
}
async function off() {
  await service.from("rooms").update({ fixture_id: -1 }).eq("id", ROOM);
  await service.from("fixtures").delete().eq("id", FIXTURE);
  console.log(`reverted room ${ROOM} to seed fixture -1`);
}
(process.argv[2] === "off" ? off() : on()).catch((e) => { console.error(e); process.exit(1); });
