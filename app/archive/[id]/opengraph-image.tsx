import { ImageResponse } from "next/og";
import { getPreviewEntries } from "@/lib/archive/index";
import { ARCHIVE_MEDIUM_TAGS } from "@/lib/archive/labels";
import { loadBodoniModaForOg } from "@/lib/archive/og-font";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  const entry = getPreviewEntries().find((item) => item.id === id);
  const title = entry?.title ?? "The Beautiful Archive";
  const medium = entry ? ARCHIVE_MEDIUM_TAGS[entry.medium] : "Archive";
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
          {medium}
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
              fontSize: title.length > 48 ? 56 : 72,
              lineHeight: 1.05,
              color: "#0A111F",
              fontFamily: "Bodoni Moda",
              fontWeight: 600,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#0A111F",
              opacity: 0.72,
              fontFamily: "Bodoni Moda",
              fontWeight: 600,
            }}
          >
            The Beautiful Archive
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
