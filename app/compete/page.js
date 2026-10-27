import Link from "next/link";
import { HUB_ORIGIN } from "@/lib/hosts";

export const metadata = {
  title: "Compete",
  description: "Compete is on its way.",
};

export default function CompetePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center gap-6 bg-paper px-6 py-16 text-navy">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-navy/50">The Reflective Football</p>
      <h1 className="font-display text-4xl uppercase tracking-wide">Compete</h1>
      <p className="text-base leading-relaxed text-navy/80">This app is on its way.</p>
      <Link
        href={HUB_ORIGIN}
        className="inline-flex min-h-12 items-center text-sm font-semibold uppercase tracking-widest text-signal"
      >
        Back to the hub
      </Link>
    </main>
  );
}
