import { Bodoni_Moda, Archivo } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InstallHint from "@/components/InstallHint";
import NavigationProgress from "@/components/NavigationProgress";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/config";
import "./globals.css";

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

export const metadata = {
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

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2EDE4" },
    { media: "(prefers-color-scheme: dark)", color: "#F2EDE4" },
  ],
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${bodoni.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NavigationProgress />
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
        <InstallHint />
      </body>
    </html>
  );
}
