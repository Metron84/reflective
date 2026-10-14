import { programmeSignInHref } from "@/lib/programme/links";
import styles from "./ProgrammePitch.module.css";

const HOLDS = [
  {
    title: "Game scores",
    copy: "Your best scores and streaks in Are You Really a Fan?, Codemaster and The Guesser.",
  },
  {
    title: "Crest leagues",
    copy: "The club The Crest picks for you, and the club it finds for you in every league.",
  },
  {
    title: "Honours",
    copy: "Badges for perfect scores, streaks and revealing every league.",
  },
];

/** What a signed-out visitor sees at /account: what the Programme holds, and one button. */
export default function ProgrammePitch() {
  return (
    <section className={styles.pitch} aria-labelledby="pitch-title">
      <h1 id="pitch-title" className={styles.title}>
        Start your Programme
      </h1>
      <p className={styles.lede}>One place for everything you play and earn here. Free.</p>

      <ul className={styles.holds}>
        {HOLDS.map((item) => (
          <li key={item.title} className={styles.hold}>
            <h2 className={styles.holdTitle}>{item.title}</h2>
            <p className={styles.holdCopy}>{item.copy}</p>
          </li>
        ))}
      </ul>

      <a href={programmeSignInHref()} className={styles.button}>
        Start my Programme
      </a>
      <p className={styles.note}>
        Magic link or Google, no password. Played something already? We keep it for you.
      </p>
    </section>
  );
}
