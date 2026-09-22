const BODY = {
  id: "/ultima",
  name: "Ultima",
  short_name: "Ultima",
  description: "Draft Europe's top five. Invite only.",
  start_url: "/ultima",
  scope: "/",
  display: "standalone",
  background_color: "#F2EDE4",
  theme_color: "#F2EDE4",
  icons: [
    {
      src: "/brand/trf-icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/brand/trf-icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/brand/trf-maskable-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/brand/trf-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

export function GET() {
  return new Response(JSON.stringify(BODY), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
