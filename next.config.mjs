import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "app/sw.js",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  cacheOnNavigation: false,
  // Never glob all of /public (banners/textures are huge). Precache only what
  // the offline shell needs; other /brand/* assets use CacheFirst at runtime.
  globPublicPatterns: [],
  additionalPrecacheEntries: [
    { url: "/offline", revision },
    { url: "/brand/trf-crest-transparent.png", revision },
    { url: "/brand/trf-icon-192.png", revision },
    { url: "/brand/trf-maskable-192.png", revision },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default withSerwist(nextConfig);
