export default function ReportRibbon() {
  return (
    <p className="w-full border-b border-navy/10 bg-paper px-4 py-2.5 text-center font-body text-[13px] leading-snug tracking-[0.01em] text-navy sm:text-sm">
      <span
        aria-hidden
        className="mr-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal align-middle"
      />
      <span className="sm:hidden">
        New: <em>Who Is Football For?</em> Fan testimony from the 2026 World
        Cup.{" "}
      </span>
      <span className="hidden sm:inline">
        New: <em>Who Is Football For?</em> Fan Testimony from the 2026 FIFA World
        Cup.{" "}
      </span>
      <a
        href="https://doi.org/10.5281/zenodo.21713449"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Read Who Is Football For, fan testimony from the 2026 World Cup, on Zenodo"
        className="text-signal underline decoration-1 underline-offset-[3px] hover:decoration-2"
      >
        Read the report
      </a>
    </p>
  );
}
