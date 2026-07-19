export const metadata = {
  title: "Tagging admin",
  robots: { index: false, follow: false },
};

export default function TaggingAdminLayout({ children }) {
  return (
    <div className="flex-1 bg-paper text-navy">
      <div className="border-b border-navy/10 bg-paper/95">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-navy/45">
            Internal
          </p>
          <h1 className="mt-1 font-display text-3xl text-navy sm:text-4xl">
            Concierge tagging
          </h1>
          <p className="mt-1 text-sm text-navy/55">
            Tag videos, venues, and fan groups after publish.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
