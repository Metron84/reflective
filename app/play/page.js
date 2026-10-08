import { headers } from "next/headers";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import FansButton from "@/components/play/FansButton";
import PlayGame from "@/components/play/PlayGame";
import { getRenderClient } from "@/lib/supabase/server";
import { isPlayHost, mainSiteOrigin } from "@/lib/play/host.js";
import { dubaiWeekStart, lastDubaiWeekStart, weekLabel } from "@/lib/play/week.js";
import styles from "./page.module.css";

export const metadata = {
  title: "Are You Really a Fan?",
  description: "Spin the wheel, answer the clue, and see this week's leaderboard.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LIMIT = 20;

async function loadWeek(supabase, weekStart) {
  if (!supabase) return [];
  const { data } = await supabase
    .from("fan_quiz_leaderboard")
    .select("rank, display_name, score, correct, answered")
    .eq("week_start", weekStart)
    .order("rank", { ascending: true })
    .limit(LIMIT);
  return data ?? [];
}

function Board({ title, weekStart, rows, emptyHint }) {
  return (
    <section className={styles.board} aria-label={title}>
      <h2 className={styles.boardTitle}>
        {title} <span className={styles.boardDates}>{weekLabel(weekStart)}</span>
      </h2>
      {rows.length ? (
        <ol className={styles.rows}>
          {rows.map((r) => (
            <li key={`${r.rank}-${r.display_name}`} className={styles.row}>
              <span className={styles.rank}>{r.rank}</span>
              <span className={styles.name}>{r.display_name}</span>
              <span className={styles.meta}>{r.correct} correct</span>
              <span className={styles.score}>{r.score}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>{emptyHint}</p>
      )}
    </section>
  );
}

export default async function PlayPage({ searchParams }) {
  const sp = await searchParams;
  const host = (await headers()).get("host");
  // On the play host other site pages are not served, so links go to the main site.
  const playApp = isPlayHost(host);
  const base = playApp ? mainSiteOrigin(host) : "";
  const supabase = await getRenderClient();
  const now = new Date();
  const thisWeek = dubaiWeekStart(now);
  const lastWeek = lastDubaiWeekStart(now);
  const [current, previous] = await Promise.all([
    loadWeek(supabase, thisWeek),
    loadWeek(supabase, lastWeek),
  ]);

  const board = (
    <div className={styles.inner}>
      <Board title="This week" weekStart={thisWeek} rows={current} emptyHint="No scores yet. Be the first on the board." />
      <Board title="Last week" weekStart={lastWeek} rows={previous} emptyHint="No scores from last week." />
      <p className={styles.note}>Weeks run Monday to Sunday, Dubai time. Your first saved score each day counts.</p>
      <div className={styles.actions}>
        <FansButton />
        <Link href={`${base}/guesser`} className={styles.secondary}>Play The Guesser</Link>
        <Link href={`${base}/ultima`} className={styles.secondary}>Play Ultima</Link>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      {playApp ? (
        <header className={styles.hostBar}>
          <a href={base} className={styles.hostLink}>The Reflective Football</a>
        </header>
      ) : (
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Play" }]} />
      )}
      <PlayGame autoSave={sp?.save === "1"} board={board} base={base} />
    </div>
  );
}
