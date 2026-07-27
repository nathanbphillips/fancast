import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { BRAND_LOGO_DATA_URI } from "@/lib/og/brandLogo";

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
        {/* full Arseradio wordmark (neon) — eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND_LOGO_DATA_URI}
          width={452}
          height={86}
          alt={brand.name}
          style={{ objectFit: "contain" }}
        />

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
