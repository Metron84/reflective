import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { manifestForSubdomain } from "@/lib/subdomains";

function hasIcon(src) {
  return existsSync(path.join(process.cwd(), "public", src.replace(/^\//, "")));
}

export function GET(request) {
  const host = request.headers.get("host");
  return NextResponse.json(manifestForSubdomain(host, hasIcon), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
      Vary: "Host",
    },
  });
}
