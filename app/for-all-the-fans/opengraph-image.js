import { ImageResponse } from "next/og";
import { loadArchivoForOg, loadBodoniModaForOg } from "@/lib/archive/og-font";

export const runtime = "nodejs";
export const alt = "For All The Fans";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [bodoni, archivo] = await Promise.all([
    loadBodoniModaForOg(),
    loadArchivoForOg(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0A111F",
          padding: "72px 80px 56px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#F2EDE4",
            fontFamily: "Archivo",
          }}
        >
          The Reflective Football
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 72,
              lineHeight: 1.05,
              color: "#F2EDE4",
              fontFamily: "Bodoni Moda",
            }}
          >
            For All The Fans
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 28,
              lineHeight: 1.3,
              color: "#F2EDE4",
              fontFamily: "Bodoni Moda",
              maxWidth: 900,
            }}
          >
            One night a month, the room goes to them.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: "0.08em",
            color: "rgba(242, 237, 228, 0.55)",
            fontFamily: "Archivo",
          }}
        >
          thereflectivefootball.com
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Bodoni Moda",
          data: bodoni,
          style: "normal",
          weight: 400,
        },
        {
          name: "Archivo",
          data: archivo,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
