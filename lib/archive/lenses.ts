import lensesJson from "@/content/archive/lenses.json";

export type ArchiveLensVoice = "historian" | "psychologist" | "sceptic";

export type ArchiveLensPassage = {
  voice: ArchiveLensVoice;
  text: string;
};

export type ArchiveLensRecord = {
  entryId: string;
  lenses: ArchiveLensPassage[];
};

const records = lensesJson as ArchiveLensRecord[];

export const ARCHIVE_LENS_VOICE_LABELS: Record<ArchiveLensVoice, string> = {
  historian: "The Historian",
  psychologist: "The Psychologist",
  sceptic: "The Sceptic",
};

/** Static lenses for an archive entry. Empty when none exist. */
export function getLensesForEntry(entryId: string): ArchiveLensPassage[] {
  const record = records.find((item) => item.entryId === entryId);
  return record?.lenses ?? [];
}
