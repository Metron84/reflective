import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "The Reflective Football. Football is nothing without the fans.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const crest = await readFile(
    join(process.cwd(), "public/brand/trf-icon-512.png")
  );
  const crestSrc = `data:image/png;base64,${crest.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(to bottom, #0A111F, #060B14)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={crestSrc} alt="" width={300} height={300} />
        <div
          style={{
            marginTop: 36,
            fontSize: 56,
            color: "#F2EDE4",
            letterSpacing: 2,
          }}
        >
          The Reflective Football
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 28,
            color: "rgba(242, 237, 228, 0.75)",
            letterSpacing: 1,
          }}
        >
          Football is nothing without the fans.
        </div>
      </div>
    ),
    { ...size }
  );
}
