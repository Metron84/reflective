import Link from "next/link";
import styles from "./GamesSection.module.css";

function Tile({ id, name, stats, cta, href, played, quiet, children }) {
  return (
    <article id={id} className={`${styles.tile} ${played ? "" : styles.tileQuiet}`}>
      <h3 className={styles.name}>{name}</h3>
      {played ? (
        <>
          {stats ? (
            <dl className={styles.stats}>
              {stats.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {children}
        </>
      ) : (
        <p className={styles.quiet}>{quiet}</p>
      )}
      <Link href={href} className={styles.cta}>
        {played ? cta : "Play your first"}
      </Link>
    </article>
  );
}

/**
 * @param {{games: object, crestTile?: import("react").ReactNode}} props
 */
export default function GamesSection({ games, crestTile }) {
  const { quiz, codemaster, guesser } = games;
  return (
    <section className={styles.section} aria-labelledby="games-title">
      <h2 id="games-title" className={styles.title}>
        Your games
      </h2>
      <div className={styles.grid}>
        <Tile
          name="Are You Really a Fan?"
          played={quiz.played > 0}
          quiet="Ten questions. One spin each."
          href="/play"
          cta="Spin"
          stats={[
            ["Best", `${quiz.best}/10`],
            ["Played", quiz.played],
            ["This week", quiz.rank ? `#${quiz.rank}` : "Not ranked"],
          ]}
        />
        <Tile
          name="Codemaster"
          played={codemaster.solved > 0}
          quiet="Drop the letters back into place."
          href="/codemaster"
          cta="Continue"
          stats={[
            ["Codes solved", codemaster.solved],
            ["Title", codemaster.title],
          ]}
        />
        {crestTile}
        <Tile
          name="The Guesser"
          played={guesser.boards > 0}
          quiet="Five players a day. Twenty points."
          href="/guesser"
          cta={guesser.today == null ? "Play today" : "Open The Guesser"}
          stats={[
            ["Today", guesser.today == null ? "Not yet" : `${guesser.today}/${guesser.max}`],
            ["Best", guesser.best == null ? "None" : `${guesser.best}/${guesser.max}`],
            ["Played", guesser.boards],
          ]}
        />
      </div>
    </section>
  );
}

export { Tile };
