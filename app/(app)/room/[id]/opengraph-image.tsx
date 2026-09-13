import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { createServiceClient } from "@/lib/db/server";
import { looksLikeUuid } from "@/lib/slug";
import { OG, ogFontOptions } from "@/lib/og/fonts";

/**
 * Per-room social-share card (1200x630): a programme cover for THIS fixture.
 * Paper field, ink masthead, the fixture in Anton with the red "v", the host
 * line in Newsreader italic. Text + rules only (no crest/photo: golden rule +
 * affiliation safety). Compliance: it advertises the listening room, never a
 * broadcast of the match. Node runtime; real fonts via lib/og/fonts.
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
          background: OG.paper,
          color: OG.ink,
          fontFamily: "Newsreader",
          padding: "0 72px 52px",
        }}
      >
        {/* masthead: 6px ink rule, wordmark strip, 2px rule */}
        <div style={{ display: "flex", height: "10px", background: OG.ink, width: "100%", marginTop: "44px" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 4px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Anton",
              fontSize: "44px",
              letterSpacing: "0.01em",
            }}
          >
            <span style={{ color: OG.red }}>ARSE</span>
            <span style={{ color: OG.ink }}>RADIO</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "24px",
              letterSpacing: "0.14em",
              color: OG.red,
            }}
          >
            <div
              style={{
                display: "flex",
                width: "14px",
                height: "14px",
                borderRadius: "9999px",
                background: OG.red,
              }}
            />
            MATCHDAY ROOM
          </div>
        </div>
        <div style={{ display: "flex", height: "2px", background: OG.ink, width: "100%" }} />

        {/* fixture */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              fontFamily: "Anton",
              fontSize: away ? "112px" : "96px",
              lineHeight: 1.02,
              letterSpacing: "0.01em",
              maxWidth: "1040px",
              textTransform: "uppercase",
            }}
          >
            {away ? (
              <>
                <span>{home}</span>
                <span style={{ color: OG.red, fontSize: "64px", padding: "0 26px" }}>v</span>
                <span>{away}</span>
              </>
            ) : (
              <span>{home}</span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "26px",
              fontStyle: "italic",
              fontSize: "32px",
              opacity: 0.8,
            }}
          >
            {host ? `Hosted by @${host} · ` : ""}Listen alongside on your own stream
          </div>
        </div>

        {/* footer rule + compliance line */}
        <div style={{ display: "flex", height: "2px", background: OG.ink, width: "100%" }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            paddingTop: "20px",
            fontSize: "24px",
            letterSpacing: "0.14em",
          }}
        >
          FREE TO LISTEN · AUDIO ONLY, ALWAYS
        </div>
      </div>
    ),
    { ...size, fonts: await ogFontOptions() },
  );
}
