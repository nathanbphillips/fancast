import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { OG, ogFontOptions } from "@/lib/og/fonts";

/**
 * Default social-share card (1200x630): the programme cover. Paper field, ink
 * masthead rules, the two-tone ARSERADIO wordmark in Anton, the tagline in
 * Newsreader italic. Text + rules only (no crest/photo: golden rule +
 * affiliation safety); real fonts via lib/og/fonts. Node runtime.
 */

export const alt = `${brand.name}: the matchday programme for Arsenal fans`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const now = new Date();
  const seasonStartYear =
    now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const season = `${seasonStartYear}-${String((seasonStartYear + 1) % 100).padStart(2, "0")}`;

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
          padding: "0 72px 56px",
        }}
      >
        {/* masthead: 6px ink rule, strip, 2px rule */}
        <div style={{ display: "flex", height: "10px", background: OG.ink, width: "100%", marginTop: "48px" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 4px",
            fontSize: "26px",
            letterSpacing: "0.14em",
          }}
        >
          <div style={{ display: "flex" }}>SEASON {season}</div>
          <div style={{ display: "flex", gap: "12px" }}>
            <span style={{ textDecoration: "line-through", opacity: 0.55 }}>
              PRICE 10p
            </span>
            <span style={{ color: OG.red }}>£0</span>
          </div>
        </div>
        <div style={{ display: "flex", height: "2px", background: OG.ink, width: "100%" }} />

        {/* cover */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Anton",
              fontSize: "168px",
              lineHeight: 1,
              letterSpacing: "0.01em",
            }}
          >
            <span style={{ color: OG.red }}>ARSE</span>
            <span style={{ color: OG.ink }}>RADIO</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "26px",
              fontStyle: "italic",
              fontSize: "34px",
              opacity: 0.8,
              maxWidth: "900px",
              textAlign: "center",
            }}
          >
            Real supporters in your ear, never pundits.
          </div>
        </div>

        {/* footer rule + lamp line */}
        <div style={{ display: "flex", height: "2px", background: OG.ink, width: "100%" }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            paddingTop: "22px",
            fontSize: "26px",
            letterSpacing: "0.14em",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "18px",
              height: "18px",
              borderRadius: "9999px",
              background: OG.red,
            }}
          />
          THE MATCHDAY PROGRAMME FOR ARSENAL FANS
        </div>
      </div>
    ),
    { ...size, fonts: await ogFontOptions() },
  );
}
