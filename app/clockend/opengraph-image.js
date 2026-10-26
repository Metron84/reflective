import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Arsenal fans celebrating together in Dubai";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STRIP = 150;

function readProjectFile(...parts) {
  return readFileSync(path.join(process.cwd(), ...parts));
}

export default function Image() {
  const hero = readProjectFile("public", "clockend", "hero.jpg");
  const heroSrc = `data:image/jpeg;base64,${hero.toString("base64")}`;
  const photoHeight = size.height - STRIP;

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#A50010",
        }}
      >
        <img
          src={heroSrc}
          alt=""
          width={size.width}
          height={photoHeight}
          style={{
            width: size.width,
            height: photoHeight,
            objectFit: "cover",
            objectPosition: "center top",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: size.width,
            height: STRIP,
            backgroundColor: "#A50010",
            padding: "0 48px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Montserrat",
              fontWeight: 900,
              fontSize: 72,
              lineHeight: 1,
              color: "#FFFFFF",
              letterSpacing: "-0.03em",
            }}
          >
            CLOCK END DUBAI
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: 28,
              lineHeight: 1,
              color: "#E2C47A",
              letterSpacing: "0.06em",
            }}
          >
            PUT YOUR NAME DOWN
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Montserrat",
          data: readProjectFile("app", "fonts", "montserrat", "Montserrat-Black.ttf"),
          style: "normal",
          weight: 900,
        },
        {
          name: "Montserrat",
          data: readProjectFile("app", "fonts", "montserrat", "Montserrat-ExtraBold.ttf"),
          style: "normal",
          weight: 800,
        },
      ],
    },
  );
}
