import { readFile } from "node:fs/promises";
import path from "node:path";

let cachedFont: ArrayBuffer | null = null;

/**
 * Load Bodoni Moda as WOFF for next/og (Satori). Prefers a local file if
 * present; otherwise fetches a WOFF (not WOFF2) URL from Google Fonts.
 */
export async function loadBodoniModaForOg(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;

  const localPath = path.join(
    process.cwd(),
    "public/brand/BodoniModa-SemiBold.woff",
  );
  try {
    const local = await readFile(localPath);
    cachedFont = local.buffer.slice(
      local.byteOffset,
      local.byteOffset + local.byteLength,
    );
    return cachedFont;
  } catch {
    // Fall through to Google Fonts.
  }

  const css = await fetch(
    "https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@600&display=swap",
    {
      headers: {
        // Older UA so Google returns WOFF (Satori rejects WOFF2).
        "User-Agent":
          "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)",
      },
    },
  ).then((res) => res.text());

  const match = css.match(/src: url\(([^)]+)\) format\('woff'\)/);
  if (!match?.[1]) {
    throw new Error("Could not resolve Bodoni Moda woff URL");
  }

  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) {
    throw new Error(`Failed to fetch Bodoni Moda: ${fontRes.status}`);
  }

  cachedFont = await fontRes.arrayBuffer();
  return cachedFont;
}
