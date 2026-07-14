import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

/**
 * Default social-share card for every route (1200×630). Vector + text only — the
 * brand pulse mark, wordmark, and tagline on the dark canvas, with a gold accent
 * and a red live dot. No photography/crest (golden rule + affiliation safety).
 */

export const alt = `${brand.name}: live fan commentary for Arsenal matches`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background: "#08080a",
          color: "#f2f2f4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "76px",
              height: "76px",
              borderRadius: "18px",
              background: "#f4f4f2",
            }}
          >
            <svg
              width="46"
              height="46"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#08080a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12h3.5l2 6 4-15 2.5 9H21" />
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "64px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ color: "#ef0107" }}>{brand.logoParts.accent}</span>
            <span style={{ color: "#f2f2f4" }}>{brand.logoParts.base}</span>
          </div>
        </div>

        <div
          style={{
            marginTop: "48px",
            fontSize: "58px",
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: "920px",
          }}
        >
          Live fan commentary for Arsenal matches.
        </div>

        <div
          style={{
            marginTop: "32px",
            width: "120px",
            height: "8px",
            borderRadius: "4px",
            background: "#ef0107",
          }}
        />

        <div
          style={{
            marginTop: "40px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontSize: "30px",
            color: "#9ba1ac",
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "9999px",
              background: "#ef0107",
            }}
          />
          Watch your stream. Listen with us.
        </div>
      </div>
    ),
    size,
  );
}
