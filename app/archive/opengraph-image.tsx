import { ImageResponse } from "next/og";
import { loadBodoniModaForOg } from "@/lib/archive/og-font";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The Beautiful Archive";

export default async function Image() {
  const fontData = await loadBodoniModaForOg();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#F2EDE4",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#D8232A",
            fontFamily: "Bodoni Moda",
            fontWeight: 600,
          }}
        >
          Archive
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 72,
              lineHeight: 1.05,
              color: "#0A111F",
              fontFamily: "Bodoni Moda",
              fontWeight: 600,
              maxWidth: 1000,
            }}
          >
            The Beautiful Archive
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "#0A111F",
              opacity: 0.72,
              fontFamily: "Bodoni Moda",
              fontWeight: 600,
            }}
          >
            Football in books, film, photography, music and art.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Bodoni Moda",
          data: fontData,
          style: "normal",
          weight: 600,
        },
      ],
    },
  );
}
