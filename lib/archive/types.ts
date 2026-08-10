export type ArchiveMedium =
  | "documentary"
  | "docuseries"
  | "film"
  | "book"
  | "photography"
  | "music"
  | "artwork"
  | "museum"
  | "exhibition";

export type ArchiveRegion =
  | "Europe"
  | "South America"
  | "North America"
  | "Africa"
  | "Asia"
  | "Middle East"
  | "Oceania"
  | "International";

export type ArchiveSubject =
  | "club"
  | "nation"
  | "player"
  | "fans"
  | "tournament"
  | "culture"
  | "politics"
  | "tactics";

export type ArchiveTone =
  | "light"
  | "serious"
  | "elegiac"
  | "aerial"
  | "angry"
  | "celebratory"
  | "investigative";

export type ArchiveDifficulty = "newcomer" | "familiar" | "deep";

export interface ArchiveEntry {
  id: string; // kebab-case slug of title + year
  medium: ArchiveMedium;
  title: string;
  originalTitle?: string;
  creator: string;
  year: number | null;
  country: string;
  language: string;
  runtimeOrLength?: string;
  subject: ArchiveSubject;
  subjectName: string;
  region: ArchiveRegion;
  tone: ArchiveTone;
  difficulty: ArchiveDifficulty;
  logline: string; // max 25 words
  whyItMatters: string; // max 30 words
  whereToFind: string;
  availabilityNote?: string;
  awards?: string;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
  verified: boolean; // default false, set true only by hand
  status: "published" | "holding";
}

export interface ArchiveQuarantineItem {
  title: string;
  reason: string;
  /** Optional context for a later discrete-work pass (e.g. fanbase name). */
  note?: string;
}
