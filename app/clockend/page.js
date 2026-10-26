import ClockEndSignup from "@/components/clockend/ClockEndSignup";
import { CLOCKEND_PUBLIC } from "@/lib/config";

const TITLE = "Clock End Dubai";
const DESCRIPTION =
  "Bring the noise. Keep your seat. Put your name down for the Arsenal section in Dubai.";
const SHARE_ALT = "Arsenal fans celebrating together in Dubai";

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/clockend" },
  robots: CLOCKEND_PUBLIC ? undefined : { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://thereflectivefootball.com/clockend",
    type: "website",
    siteName: "The Reflective Football",
    images: [
      {
        url: "/clockend/opengraph-image",
        width: 1200,
        height: 630,
        alt: SHARE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/clockend/twitter-image"],
  },
};

export const viewport = { themeColor: "#A50010" };

export default function ClockEndPage() {
  return <ClockEndSignup />;
}
