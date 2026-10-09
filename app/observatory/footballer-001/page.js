import FootballerStudy from "@/components/observatory/FootballerStudy";
import { OBSERVATORY_ENABLED, SITE_URL } from "@/lib/config";
import { montserrat } from "../montserrat";

export const metadata = {
  title: "What Should a Footballer Be? | The Observatory",
  description: "A ten-question study on the kind of footballer fans really want. Anonymous, takes two minutes.",
  alternates: { canonical: `${SITE_URL}/observatory/footballer-001` },
  robots: OBSERVATORY_ENABLED ? { index: true, follow: true } : { index: false, follow: false },
};

export default function FootballerStudyPage() {
  return (
    <div className={`${montserrat.variable} bg-[#F2EDE4] text-[#0A111F]`}>
      <FootballerStudy />
    </div>
  );
}
