import VideoResultCard from "./VideoResultCard";
import VenueResultCard from "./VenueResultCard";
import styles from "./ResultRail.module.css";

export default function ResultRail({ results, onSeeVideos, disabled }) {
  if (!Array.isArray(results) || !results.length) return null;

  return (
    <div className={styles.rail} role="list">
      {results.map((item) => {
        if (item.type === "video") {
          return (
            <div key={`video-${item.id}`} role="listitem" className={styles.item}>
              <VideoResultCard video={item} />
            </div>
          );
        }
        if (item.type === "venue") {
          return (
            <div key={`venue-${item.id}`} role="listitem" className={styles.item}>
              <VenueResultCard
                venue={item}
                onSeeVideos={onSeeVideos}
                disabled={disabled}
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
