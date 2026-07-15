import styles from "./ProgrammeHeader.module.css";

export default function ProgrammeHeader({ profile }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.name}>{profile.preferredName}</h1>
      <p className={styles.meta}>
        Member {profile.memberNumber} · Since {profile.memberSince}
      </p>
      {profile.clubs?.length > 0 ? (
        <ul className={styles.clubs}>
          {profile.clubs.map((club) => (
            <li key={club}>{club}</li>
          ))}
        </ul>
      ) : null}
      <div className={styles.rule} aria-hidden="true" />
    </header>
  );
}
