import ClockEndSignup from "@/components/clockend/ClockEndSignup";
import { CLOCKEND_PUBLIC } from "@/lib/config";

export const metadata = {
  title: "Clock End Dubai",
  description: "Put your name down for the Clock End Dubai.",
  alternates: { canonical: "/clockend" },
  robots: CLOCKEND_PUBLIC ? undefined : { index: false, follow: false },
};

export const viewport = { themeColor: "#A50010" };

export default function ClockEndPage() {
  return <ClockEndSignup />;
}
