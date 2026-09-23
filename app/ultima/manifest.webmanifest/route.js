import { headers } from "next/headers";
import { isUltimaAppHost } from "@/lib/ultima/host";

export async function GET() {
  const app = isUltimaAppHost((await headers()).get("host"));
  const body = {
    id: app ? "/" : "/ultima",
    name: "Ultima",
    short_name: "Ultima",
    description: "Draft Europe's top five. Invite only.",
    start_url: app ? "/" : "/ultima",
    scope: "/",
    display: "standalone",
    background_color: "#12151C",
    theme_color: "#12151C",
    icons: [
      {
        src: "/ultima/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/ultima/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/ultima/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/ultima/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
