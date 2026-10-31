import { FEEDBACK_GROUPS } from "@/lib/your-say";
import { yourSayDisplay } from "./displayFont";
import styles from "./FeedbackWall.module.css";

function tagLabel(tag) {
  if (tag === "critique") return { text: "CRITIQUE", className: styles.critique };
  if (tag === "note") return { text: "NOTE", className: styles.note };
  return null;
}

export default function FeedbackWall() {
  return (
    <>
      <div className={styles.band}>
        <p className={styles.eyebrow}>What the clubs say</p>
        <p
          className={`${yourSayDisplay.className} ${styles.standfirst}`}
          style={{ fontFamily: yourSayDisplay.style.fontFamily }}
        >
          Every comment we have received, the good and the critical.
        </p>
      </div>

      {FEEDBACK_GROUPS.map((group) => (
        <section key={group.club} className={styles.group} aria-label={group.club}>
          <div className={styles.groupHead}>
            <span
              className={styles.dot}
              style={{ backgroundColor: group.colour }}
              aria-hidden="true"
            />
            <h2 className={styles.club}>{group.club}</h2>
          </div>
          <ul className={styles.list}>
            {group.items.map((item) => {
              const tag = tagLabel(item.tag);
              return (
                <li key={item.text} className={styles.item}>
                  {tag ? (
                    <p className={`${styles.tag} ${tag.className}`}>{tag.text}</p>
                  ) : null}
                  <p className={styles.quote}>{`“${item.text}”`}</p>
                  {item.aside ? <p className={styles.aside}>{item.aside}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
