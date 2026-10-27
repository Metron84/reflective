import { existsSync } from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import { manifestForHost } from "@/lib/hosts";

function hasIcon(src) {
  return existsSync(path.join(process.cwd(), "public", src.replace(/^\//, "")));
}

export default async function manifest() {
  const host = (await headers()).get("host");
  return manifestForHost(host, hasIcon);
}
