import Link from "next/link";
import { OBSERVATORY_ENABLED, SITE_URL } from "@/lib/config";
import { REPORT_DOI } from "@/lib/report";

export const metadata = {
  title: "The Observatory | The Reflective Football",
  description: "Where TRF studies football fans. Open studies you can take part in, and the reports that come out of them.",
  alternates: { canonical: `${SITE_URL}/observatory` },
  robots: OBSERVATORY_ENABLED ? { index: true, follow: true } : { index: false, follow: false },
};

export default function ObservatoryPage() {
  return (
    <div className="bg-[#F2EDE4] text-[#0A111F]" style={{ fontFamily: "var(--font-body), Archivo, sans-serif" }}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:py-14">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">The Observatory</h1>
          <p className="max-w-xl text-lg leading-snug">
            Where TRF studies football fans. Open studies you can take part in, and the reports that come out of them.
          </p>
        </header>

        <section className="flex flex-col gap-4" aria-label="Open studies">
          <h2 className="text-sm font-semibold uppercase tracking-widest">Open studies</h2>
          <Link
            href="/observatory/footballer-001"
            className="rounded-[14px] border-2 border-[#0A111F] p-5 transition-colors motion-reduce:transition-none hover:bg-[#0A111F]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-[#D8232A]">Open</p>
            <h3 className="mt-2 text-2xl font-semibold">What should a footballer be?</h3>
            <p className="mt-2">Ten questions. Two minutes. Anonymous.</p>
          </Link>
        </section>

        <section className="flex flex-col gap-4" aria-label="Reports">
          <h2 className="text-sm font-semibold uppercase tracking-widest">Reports</h2>
          <a
            href={REPORT_DOI}
            target="_blank"
            rel="noreferrer"
            className="rounded-[14px] border-2 border-[#0A111F] p-5 transition-colors motion-reduce:transition-none hover:bg-[#0A111F]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]"
          >
            <h3 className="text-2xl font-semibold">The fan interview report</h3>
            <p className="mt-2">Around 400 fan interviews from May 2026 to the World Cup final.</p>
          </a>
        </section>
      </div>
    </div>
  );
}
