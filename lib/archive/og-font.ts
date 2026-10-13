let cachedFont: ArrayBuffer | null = null;

/**
 * Load Archivo Black as WOFF for next/og (Satori). Fetches a WOFF (not WOFF2)
 * URL from Google Fonts.
 */
export async function loadArchivoBlackForOg(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;

  const css = await fetch(
    "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
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
    throw new Error("Could not resolve Archivo Black woff URL");
  }

  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) {
    throw new Error(`Failed to fetch Archivo Black: ${fontRes.status}`);
  }

  cachedFont = await fontRes.arrayBuffer();
  return cachedFont;
}

let cachedArchivo: ArrayBuffer | null = null;

/** Load Archivo as WOFF for next/og (Satori). Same Google Fonts WOFF path as Archivo Black. */
export async function loadArchivoForOg(): Promise<ArrayBuffer> {
  if (cachedArchivo) return cachedArchivo;

  const css = await fetch(
    "https://fonts.googleapis.com/css2?family=Archivo:wght@400&display=swap",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)",
      },
    },
  ).then((res) => res.text());

  const match = css.match(/src: url\(([^)]+)\) format\('woff'\)/);
  if (!match?.[1]) {
    throw new Error("Could not resolve Archivo woff URL");
  }

  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) {
    throw new Error(`Failed to fetch Archivo: ${fontRes.status}`);
  }

  cachedArchivo = await fontRes.arrayBuffer();
  return cachedArchivo;
}
