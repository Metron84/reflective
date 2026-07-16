"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  youtubeThumbnailUrl,
  youtubeVerticalThumbnailUrl,
} from "@/lib/films/youtube";
import styles from "./CollectionsBand.module.css";

export default function CollectionsBand({ collections }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCollection = searchParams.get("collection") ?? "";

  if (!collections?.length) return null;

  function openCollection(playlistId) {
    const next = new URLSearchParams(searchParams.toString());
    if (activeCollection === playlistId) {
      next.delete("collection");
    } else {
      next.set("collection", playlistId);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <section className={styles.section} aria-label="Collections">
      <h2 className={styles.heading}>Collections</h2>
      <ul className={styles.scroller} role="list">
        {collections.map((collection) => {
          const isActive = activeCollection === collection.playlistId;
          const thumb =
            youtubeVerticalThumbnailUrl(collection.thumbnailVideoId) ??
            youtubeThumbnailUrl(collection.thumbnailVideoId);
          return (
            <li key={collection.playlistId}>
              <button
                type="button"
                className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
                aria-pressed={isActive}
                onClick={() => openCollection(collection.playlistId)}
              >
                <div className={styles.thumbWrap}>
                  {thumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={styles.thumb}
                    />
                  ) : (
                    <div className={styles.thumbFallback} aria-hidden />
                  )}
                </div>
                <div className={styles.meta}>
                  <span className={styles.title}>{collection.displayTitle}</span>
                  <span className={styles.count}>
                    {collection.count}{" "}
                    {collection.count === 1 ? "film" : "films"}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
