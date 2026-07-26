import { notFound } from "next/navigation";
import StandBoard from "@/components/stand/StandBoard";
import { getAuthContext } from "@/lib/auth/session";
import {
  chapterCatalog,
  getClubOptionsForStand,
  getNationOptionsForStand,
  getPlayerOptionsForStand,
  getStandChapter,
  listStandChapters,
} from "@/lib/stand";
import styles from "./page.module.css";

/** Parked: hide from the public site. Flip to false to restore /stand. */
const STAND_PARKED = true;

export const metadata = {
  title: "The Stand",
  description:
    "Club, nation, or player. A continuous identity story. Five questions a day.",
  openGraph: {
    title: "The Stand | The Reflective Football",
    description:
      "Pick your badges. Play five questions a day. Sign up to save your chapter.",
  },
  robots: STAND_PARKED ? { index: false, follow: false } : undefined,
};

export const dynamic = "force-dynamic";

export default async function StandPage() {
  if (STAND_PARKED) notFound();

  const { isSignedIn } = await getAuthContext();
  const chapterIds = listStandChapters();
  const chaptersById = Object.fromEntries(
    chapterIds.map((id) => [id, getStandChapter(id)]),
  );
  const defaultChapterId = "sa.acf-fiorentina.ch01";
  const chapter = chaptersById[defaultChapterId];
  const clubOptions = getClubOptionsForStand();
  const nationOptions = getNationOptionsForStand();
  const playerOptions = getPlayerOptionsForStand();
  const catalog = chapterCatalog();

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <StandBoard
          chapter={chapter}
          chaptersById={chaptersById}
          clubOptions={clubOptions}
          nationOptions={nationOptions}
          playerOptions={
            playerOptions.length
              ? playerOptions
              : [{ id: "thierry-henry", label: "Thierry Henry" }]
          }
          defaultClubId="acf-fiorentina"
          defaultNationId="nation-italy"
          defaultPersonId="thierry-henry"
          defaultChapterId={defaultChapterId}
          isSignedIn={isSignedIn}
        />

        <aside className={styles.catalog} aria-label="SAMPLE chapter catalog">
          <h2 className={styles.catalogTitle}>SAMPLE packs live</h2>
          <p className={styles.catalogLede}>
            {catalog.length} chapters. Hand packs: Fiorentina, Italy, Henry.
            Other Tier A club packs are auto SAMPLE pending editorial pass.
          </p>
          <ul className={styles.catalogList}>
            {catalog.map((c) => (
              <li key={c.id}>
                <span className={styles.catalogId}>{c.id}</span>
                <span className={styles.catalogMeta}>
                  {c.title}
                  {c.generated ? " · auto" : " · hand"}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
