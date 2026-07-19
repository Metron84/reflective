import MomentRow from "./MomentRow";
import styles from "./VideoResultCard.module.css";

function formatFixtureLine(fixture, fixtureDate) {
  const parts = [];
  if (fixture) parts.push(fixture);
  if (fixtureDate) parts.push(fixtureDate);
  return parts.join(" · ");
}

export default function VideoResultCard({ video }) {
  const atmosphere =
    video.atmosphere_index != null ? Number(video.atmosphere_index) : null;
  const barPct =
    atmosphere != null ? Math.min(100, Math.max(0, (atmosphere / 10) * 100)) : 0;
  const watchHref = `https://www.youtube.com/watch?v=${encodeURIComponent(video.youtube_id)}`;
  const fixtureLine = formatFixtureLine(video.fixture, video.fixture_date);
  const moments = Array.isArray(video.moments) ? video.moments : [];

  return (
    <article className={styles.card}>
      <a
        href={watchHref}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.mediaLink}
      >
        <div className={styles.thumb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className={styles.thumbImage}
          />
        </div>
        <h3 className={styles.title}>{video.title}</h3>
      </a>
      {video.venue ? <p className={styles.venue}>{video.venue}</p> : null}
      {fixtureLine ? <p className={styles.fixture}>{fixtureLine}</p> : null}
      {atmosphere != null ? (
        <div className={styles.atmosphere} aria-label={`Atmosphere ${atmosphere} of 10`}>
          <span className={styles.atmosphereLabel}>{atmosphere}/10</span>
          <span className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: `${barPct}%` }} />
          </span>
        </div>
      ) : null}
      {Array.isArray(video.vibe_tags) && video.vibe_tags.length ? (
        <ul className={styles.tags}>
          {video.vibe_tags.slice(0, 4).map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
      {moments.length ? (
        <div className={styles.moments}>
          {moments.map((m, i) => (
            <MomentRow
              key={`${m.timestamp_seconds}-${m.label}-${i}`}
              youtubeId={video.youtube_id}
              label={m.label}
              timestampSeconds={m.timestamp_seconds}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
