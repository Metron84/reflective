import ComingSoon from "@/components/ComingSoon";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "About",
  description:
    "The Reflective Football is a fan-first football documentary network based in Dubai.",
  alternates: { canonical: "/about" },
};

// Placeholder. About page is build-order step 7.
export default function AboutPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "About" }]} />
      <ComingSoon title="About" note="Fan-first football films from Dubai." />
    </div>
  );
}
