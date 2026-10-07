import { headers } from "next/headers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InstallHint from "@/components/InstallHint";
import NavigationProgress from "@/components/NavigationProgress";
import UltimaSwRegister from "@/components/ultima/UltimaSwRegister";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/config";
import { isUltimaAppHost } from "@/lib/ultima/host";
import { isPlayHost } from "@/lib/play/host";
import { archivo } from "./fonts/archivo";
import { bodoni } from "./fonts/bodoni";
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
        alt: "The Reflective Football. Watch. Vote. Play.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Reflective Football",
    description: SITE_DESCRIPTION,
    images: ["/og-default.jpg"],
  },
  icons: {
    icon: "/brand/favicon.ico",
    apple: "/brand/trf-icon-180.png",
  },
};

export async function generateMetadata() {
  const ultimaApp = isUltimaAppHost((await headers()).get("host"));
  if (!ultimaApp) return SITE_METADATA;

  return {
    ...SITE_METADATA,
    applicationName: "Ultima",
    title: {
      default: "Ultima",
      template: "%s | Ultima",
    },
    description: "Draft Europe's top five. Invite only.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Ultima",
    },
    icons: {
      icon: [
        { url: "/ultima/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/ultima/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/ultima/apple-touch-icon.png",
    },
  };
}

export async function generateViewport() {
  const ultimaApp = isUltimaAppHost((await headers()).get("host"));
  if (ultimaApp) {
    return {
      themeColor: "#12151C",
      colorScheme: "dark",
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
  const ultimaApp = isUltimaAppHost(hdrs.get("host"));
  const pathname = hdrs.get("x-pathname") || "";
  const crestApp = pathname === "/crest" || pathname.startsWith("/crest/");
  // The play host only ever shows the game, so site navigation would lead nowhere.
  const playApp = isPlayHost(hdrs.get("host"));
  const hideChrome = ultimaApp || crestApp || playApp;

  return (
    <html
      lang="en"
      className={`${bodoni.variable} ${archivo.variable} h-full antialiased`}
    >
      <head>
        {/* Film-of-the-day / YouTube taps: skip DNS + TLS handshake cost. */}
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
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
        {hideChrome ? null : <Header />}
        <main className="flex flex-1 flex-col">{children}</main>
        {hideChrome ? null : <Footer />}
        {ultimaApp ? <UltimaSwRegister /> : crestApp || playApp ? null : <InstallHint />}
      </body>
    </html>
  );
}
