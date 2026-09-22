import styles from "./ultima.module.css";

export default function UltimaRoomHead({ kicker = "Ultima", title, aside = null, children }) {
  return (
    <header className={styles.roomHead}>
      <p className={styles.roomKicker}>{kicker}</p>
      <div className={styles.roomHeadRow}>
        <h1 className={styles.roomTitle}>{title}</h1>
        {aside}
      </div>
      {children}
    </header>
  );
}
