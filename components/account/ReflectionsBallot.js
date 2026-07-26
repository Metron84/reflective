import Link from "next/link";
import styles from "./ReflectionsBallot.module.css";

export default function ReflectionsBallot({ ballot }) {
  const { categories, votedCount, total, votingState, ballotNote } = ballot;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>The Reflectives — Your Ballot</h2>
      <p className={styles.note}>
        {ballotNote ||
          (votingState === "closed"
            ? `You voted in ${votedCount} of ${total} categories.`
            : "After each vote, that category's race opens for you.")}
      </p>

      <ul className={styles.list}>
        {categories.map((cat) => (
          <li key={cat.slug} className={styles.row}>
            <div className={styles.rowMain}>
              <h3 className={styles.categoryName}>{cat.name}</h3>
              {cat.open ? (
                cat.pick ? (
                  <p className={styles.pick}>Your pick: {cat.pick.title}</p>
                ) : (
                  <Link href={`/reflections#${cat.slug}`} className={styles.voteLink}>
                    Cast your vote
                  </Link>
                )
              ) : (
                <p className={styles.comingSoon}>Nominees announced shortly.</p>
              )}
            </div>
            {cat.pick ? (
              cat.standings.length > 0 ? (
                <ol className={styles.standings}>
                  {cat.standings.map((row, i) => (
                    <li
                      key={row.nominee_id}
                      className={
                        cat.pick?.id === row.nominee_id ? styles.leadingPick : ""
                      }
                    >
                      <span className={styles.rank}>{i + 1}.</span>
                      <span className={styles.nominee}>{row.title}</span>
                      <span className={styles.votes}>{row.votes}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.noStandings}>
                  The race fills as more fans vote.
                </p>
              )
            ) : cat.open ? (
              <p className={styles.noStandings}>Vote to open this race.</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
