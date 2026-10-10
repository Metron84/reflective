import Link from "next/link";
import { notFound } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import WatchReport from "@/components/admin/WatchReport";
import { requireAdminPage } from "@/lib/auth/admin";
import { listClubs } from "@/lib/watch-with/clubs";
import { clubReport } from "@/lib/watch-with/report";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Watch-with report",
  robots: { index: false, follow: false },
};

export default async function WatchWithReportPage({ params }) {
  await requireAdminPage();
  const { club: slug } = await params;
  const report = await clubReport(slug);
  if (!report) notFound();

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-8 text-[#0A111F]" style={{ fontFamily: "var(--font-body), Archivo, sans-serif" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <AdminNav active="watch-with" />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm">My Programme</p>
            <h1 className="text-3xl font-semibold">{report.club.name}</h1>
            <p className="mt-1">Watch-with report</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="rounded-[14px] bg-[#D8232A] px-4 py-2 text-sm font-semibold text-[#F2EDE4]" href={`/api/admin/watch-with/${slug}/export?file=ranking`}>
              Download ranking
            </a>
            <a className="rounded-[14px] border-2 border-[#0A111F] px-4 py-2 text-sm font-semibold" href={`/api/admin/watch-with/${slug}/export?file=fans`}>
              Download fans
            </a>
          </div>
        </header>
        <nav className="flex flex-wrap gap-3 text-sm">
          {listClubs().map((item) => (
            <Link key={item.slug} href={`/admin/watch-with/${item.slug}/report`} className="underline-offset-4 hover:underline">
              {item.shortName}
            </Link>
          ))}
        </nav>
        {report.offline ? <p>The study store is not connected.</p> : (
          <WatchReport club={slug} rows={report.rows} totals={report.totals} />
        )}
        <Link href="/account" className="text-sm underline-offset-4 hover:underline">Back to My Programme</Link>
      </div>
    </main>
  );
}
