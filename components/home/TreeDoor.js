"use client";

import Link from "next/link";
import { forwardRef, useEffect, useRef, useState } from "react";
import { DOOR_ICONS, IconArrow } from "./DoorIcons";
import styles from "./TreeDoor.module.css";

const ROW_ENTRANCE_BASE_MS = 680;
const ROW_ENTRANCE_STAGGER_MS = 140;

function StatusLine({ doorId, statusLine, statusLineShort }) {
  const measureRef = useRef(null);
  const [text, setText] = useState(statusLine);

  useEffect(() => {
    if (!statusLine) {
      setText(null);
      return undefined;
    }
    if (!statusLineShort || statusLineShort === statusLine) {
      setText(statusLine);
      return undefined;
    }

    const el = measureRef.current;
    if (!el) return undefined;

    const pick = () => {
      el.textContent = statusLine;
      const styles = getComputedStyle(el);
      const lineHeight = parseFloat(styles.lineHeight);
      if (!lineHeight || Number.isNaN(lineHeight)) {
        setText(statusLine);
        return;
      }
      // Use long copy when it fits in two lines; otherwise the short sentence.
      const lines = el.scrollHeight / lineHeight;
      setText(lines > 2.05 ? statusLineShort : statusLine);
    };

    pick();
    const observer = new ResizeObserver(pick);
    observer.observe(el);
    return () => observer.disconnect();
  }, [statusLine, statusLineShort]);

  if (!statusLine) return null;

  if (doorId === "games" && (text || statusLine).startsWith("New.")) {
    const line = text || statusLine;
    return (
      <span className={styles.statusLine}>
        <span className={styles.statusNew}>New</span>
        <span>{line.slice(3)}</span>
      </span>
    );
  }

  return (
    <>
      {/* Off-layout probe so we can measure the long line at the real column width. */}
      {statusLineShort ? (
        <span
          ref={measureRef}
          className={styles.statusMeasure}
          aria-hidden="true"
        />
      ) : null}
      <span
        className={
          statusLineShort ? styles.statusLineWrap : styles.statusLine
        }
      >
        {text || statusLine}
      </span>
    </>
  );
}

const TreeDoor = forwardRef(function TreeDoor(
  {
    href,
    category,
    qualifier,
    statusLine,
    statusLineShort = null,
    external = false,
    doorId,
    entranceIndex,
    skipEntrance,
    animate,
  },
  ref
) {
  const Icon = DOOR_ICONS[doorId];

  const entranceClass = skipEntrance
    ? styles.rowVisible
    : animate
      ? styles.rowEnter
      : styles.rowHidden;

  const entranceStyle =
    skipEntrance || !animate
      ? undefined
      : {
          animationDelay: `${ROW_ENTRANCE_BASE_MS + entranceIndex * ROW_ENTRANCE_STAGGER_MS}ms`,
        };

  return (
    <Link
      ref={ref}
      href={href}
      id={`tree-door-${doorId}`}
      className={`${styles.row} ${entranceClass}`}
      style={entranceStyle}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        {Icon ? <Icon className={styles.icon} /> : null}
      </span>
      <span className={styles.textBlock}>
        <span className={styles.category}>{category}</span>
        {qualifier ? (
          <span className={styles.qualifier}>{qualifier}</span>
        ) : null}
        <StatusLine
          doorId={doorId}
          statusLine={statusLine}
          statusLineShort={statusLineShort}
        />
      </span>
      <span className={styles.arrowWrap} aria-hidden="true">
        <IconArrow className={styles.arrow} />
      </span>
    </Link>
  );
});

export default TreeDoor;
