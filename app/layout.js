import { existsSync } from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import InstallHint from "@/components/InstallHint";
import NavigationProgress from "@/components/NavigationProgress";
import SwRegister from "@/components/SwRegister";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/config";
import { appForHost, canonicalUrl } from "@/lib/hosts";
import { appForSubdomain, appIcon } from "@/lib/subdomains";
import { isUltimaAppHost } from "@/lib/ultima/host";
import { isPlayHost } from "@/lib/play/host";
import { isWatchWithHost } from "@/lib/watch-with/host";
import { PLAY_SW_GUARD } from "@/lib/play/sw-cleanup";
import { archivo } from "./fonts/archivo";
import { archivoBlack } from "./fonts/archivo-black";
import { montserrat } from "./fonts/montserrat";
import "./globals.css";

const SITE_METADATA = {
  metadataBase: new URL(SITE_URL),
  applicationName: "The Reflective Football",
  title: {
    default: "The Reflective Football",
    template: "%s | The Reflective Football",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "./",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TRF",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "The Reflective Football",
    title: "The Reflective Football",
    description: SITE_DESCRIPTION,
    url: "./",
    locale: "en_US",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "The Reflective Football. Football is nothing without the fans.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Reflective Football",
    description: SITE_DESCRIPTION,
    images: ["/og-default.jpg"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/favicon.ico",
    apple: "/brand/trf-icon-180.png",
  },
};

function hasIcon(src) {
  return existsSync(path.join(process.cwd(), "public", src.replace(/^\//, "")));
}

export async function generateMetadata() {
  const hdrs = await headers();
  const host = hdrs.get("host");
  const pathname = hdrs.get("x-pathname") || "/";
  const canonical = canonicalUrl(host, pathname);
  const site = canonical
    ? {
        ...SITE_METADATA,
        metadataBase: new URL("https://www.thereflectivefootball.com"),
        alternates: { canonical },
        openGraph: { ...SITE_METADATA.openGraph, url: canonical },
      }
    : SITE_METADATA;
  const app = appForSubdomain(host);
  if (!app) return site;

  return {
    ...site,
    applicationName: app.name,
    description: app.description,
    appleWebApp: {
      capable: true,
      statusBarStyle: app.slug === "ultima" ? "black-translucent" : "default",
      title: app.shortName,
    },
    icons: {
      icon: [
        { url: appIcon(app.slug, "icon-192.png", hasIcon), sizes: "192x192", type: "image/png" },
        { url: appIcon(app.slug, "icon-512.png", hasIcon), sizes: "512x512", type: "image/png" },
      ],
      apple: appIcon(app.slug, "apple-touch-icon.png", hasIcon),
    },
  };
}

export async function generateViewport() {
  const host = (await headers()).get("host");
  const app = appForSubdomain(host);
  if (app) {
    return {
      themeColor: app.themeColor,
      colorScheme: app.slug === "ultima" ? "dark" : "light",
      viewportFit: "cover",
    };
  }

  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#F2EDE4" },
      { media: "(prefers-color-scheme: dark)", color: "#F2EDE4" },
    ],
    colorScheme: "light",
    viewportFit: "cover",
  };
}

export default async function RootLayout({ children }) {
  const hdrs = await headers();
  const host = hdrs.get("host");
  const ultimaApp = isUltimaAppHost(host);
  const pathname = hdrs.get("x-pathname") || "";
  const crestApp = pathname === "/crest" || pathname.startsWith("/crest/");
  const watchWith = pathname === "/watch-with" || pathname.startsWith("/watch-with/") || isWatchWithHost(host);
  const playApp = isPlayHost(host);
  const appHost = Boolean(appForHost(host));
  // Clock End Dubai is a standalone sign-up page: no site header or footer.
  const clockEnd = pathname === "/clockend" || pathname.startsWith("/clockend/");
  const hideChrome = appHost || crestApp || watchWith || clockEnd;

  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${archivo.variable} ${montserrat.variable} h-full antialiased`}
    >
      <head>
        {/* Film-of-the-day / YouTube taps: skip DNS + TLS handshake cost. */}
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        {playApp ? <script dangerouslySetInnerHTML={{ __html: PLAY_SW_GUARD }} /> : null}
      </head>
      <body
        className={
          ultimaApp
            ? "flex min-h-full flex-col ultima-app"
            : crestApp
              ? "flex min-h-full flex-col bg-[#0A111F]"
              : "flex min-h-full flex-col"
        }
      >
        <NavigationProgress />
        {hideChrome ? null : <SiteHeader />}
        <main className="flex flex-1 flex-col">{children}</main>
        {hideChrome ? null : <SiteFooter />}
        {appHost && !playApp ? <SwRegister /> : null}
        {ultimaApp || crestApp || playApp || clockEnd ? null : <InstallHint />}
      </body>
    </html>
  );
}
