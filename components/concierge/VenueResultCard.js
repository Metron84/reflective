import styles from "./VenueResultCard.module.css";

export default function VenueResultCard({ venue, onSeeVideos, disabled }) {
  const pills = [venue.setting, venue.capacity_vibe].filter(Boolean);

  return (
    <article className={styles.card}>
      <h3 className={styles.name}>{venue.name}</h3>
      {venue.area || venue.city ? (
        <p className={styles.area}>
          {[venue.area, venue.city].filter(Boolean).join(", ")}
        </p>
      ) : null}
      {pills.length ? (
        <ul className={styles.pills}>
          {pills.map((p) => (
            <li key={p} className={styles.pill}>
              {p}
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.meta}>
        {venue.outdoor_seating === true
          ? "Outdoor seating"
          : venue.outdoor_seating === false
            ? "No outdoor seating"
            : null}
        {venue.outdoor_seating != null && venue.video_count != null ? " · " : null}
        {venue.video_count != null
          ? `${venue.video_count} tagged video${venue.video_count === 1 ? "" : "s"}`
          : null}
      </p>
      <button
        type="button"
        className={styles.action}
        disabled={disabled}
        onClick={() => onSeeVideos(venue.name)}
      >
        See videos from here
      </button>
    </article>
  );
}
