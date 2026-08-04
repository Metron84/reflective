export const REPORT_DOI = "https://doi.org/10.5281/zenodo.21713449";

/** Edit report proof numbers in one place. Rename off SAMPLE_ before launch. */
export const SAMPLE_REPORT_STATS = [
  { value: "SAMPLE_400+", label: "Fans interviewed" },
  { value: "SAMPLE_nations", label: "Nations represented" },
  { value: "SAMPLE_hours", label: "Hours of footage" },
];

/** Two short findings sentences. Rename off SAMPLE_ before launch. */
export const SAMPLE_REPORT_FINDINGS = [
  "SAMPLE_Fans said who football is for, in their own words.",
  "SAMPLE_The picture that emerged is fans-first, not corporate.",
];

function warnIfSamplePlaceholders() {
  if (process.env.NODE_ENV === "production") return;

  const values = [
    ...SAMPLE_REPORT_STATS.flatMap((stat) => [stat.value, stat.label]),
    ...SAMPLE_REPORT_FINDINGS,
  ];

  if (values.some((value) => String(value).includes("SAMPLE"))) {
    console.warn(
      "[TRF] Report section still has SAMPLE placeholders in SAMPLE_REPORT_STATS or SAMPLE_REPORT_FINDINGS. Replace before launch."
    );
  }
}

warnIfSamplePlaceholders();
