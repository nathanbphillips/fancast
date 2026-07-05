import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { createServiceClient } from "@/lib/db/server";
import { looksLikeUuid } from "@/lib/slug";

/**
 * Per-room social-share card (1200x630). Vector + text only (no crest/photo:
 * golden rule + affiliation safety). Shows the fixture and host so a shared room
 * link reads as "come listen to THIS match with us", not a generic site card.
 * Compliance: it advertises the listening room, never a broadcast of the match.
 */

export const alt = `A ${brand.name} matchday room`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type RoomOg = {
  blurb: string | null;
  fixture: { home_team: string; away_team: string } | null;
  commentator: { username: string } | null;
};

export default async function RoomOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let home = "Arsenal";
  let away = "";
  let host: string | null = null;

  try {
    const byId = looksLikeUuid(id);
    if (byId || /^[a-z0-9-]{1,120}$/.test(id)) {
      const service = createServiceClient();
      const { data } = await service
        .from("rooms")
        .select(
          "blurb, fixture:fixtures(home_team, away_team), commentator:profiles!rooms_commentator_id_fkey(username)",
        )
        .eq(byId ? "id" : "slug", id)
        .maybeSingle<RoomOg>();
      if (data?.fixture) {
        home = data.fixture.home_team;
        away = data.fixture.away_team;
      }
      host = data?.commentator?.username ?? null;
    }
  } catch {
    /* fall back to a generic-but-branded card */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "84px",
          background: "#0f0f11",
          color: "#f4f4f2",
          fontFamily: "sans-serif",
        }}
      >
        {/* top: wordmark + live dot */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "60px",
              height: "60px",
              borderRadius: "14px",
              background: "#f4f4f2",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0f0f11"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12h3.5l2 6 4-15 2.5 9H21" />
            </svg>
          </div>
          <div style={{ fontSize: "40px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            {brand.name}
          </div>
          <div
            style={{
              marginLeft: "10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "24px",
              color: "#f1232b",
              fontWeight: 700,
              letterSpacing: "0.12em",
            }}
          >
            <div
              style={{ width: "14px", height: "14px", borderRadius: "9999px", background: "#f1232b" }}
            />
            MATCHDAY ROOM
          </div>
        </div>

        {/* middle: fixture */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: away ? "96px" : "80px",
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              maxWidth: "1000px",
            }}
          >
            {away ? `${home} vs ${away}` : home}
          </div>
          <div
            style={{
              marginTop: "28px",
              width: "120px",
              height: "8px",
              borderRadius: "4px",
              background: "#e8b54a",
            }}
          />
        </div>

        {/* bottom: host + pitch */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontSize: "30px",
            color: "#9ba1ac",
          }}
        >
          {host ? `Hosted by @${host} · ` : ""}Listen alongside on your own stream
        </div>
      </div>
    ),
    size,
  );
}
