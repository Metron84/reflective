import { headers } from "next/headers";
import { SITE_URL } from "@/lib/config";
import { isPlayHost } from "@/lib/play/host";

export default async function robots() {
  if (isPlayHost((await headers()).get("host"))) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/welcome", "/signin", "/api/", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
