import { Bodoni_Moda, Archivo } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NavigationProgress from "@/components/NavigationProgress";
import { SITE_URL } from "@/lib/config";
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
  title: {
    default: "The Reflective Football",
    template: "%s | The Reflective Football",
  },
  description:
    "Fan-first football films from Dubai. Football is nothing without the fans.",
  alternates: {
    canonical: "./",
  },
  openGraph: {
    type: "website",
    siteName: "The Reflective Football",
    title: "The Reflective Football",
    description:
      "Fan-first football films from Dubai. Football is nothing without the fans.",
    url: "./",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Reflective Football",
    description:
      "Fan-first football films from Dubai. Football is nothing without the fans.",
  },
  icons: {
    icon: "/brand/favicon.ico",
    apple: "/brand/trf-icon-180.png",
  },
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
      </body>
    </html>
  );
}
