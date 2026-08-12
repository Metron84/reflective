"use client";

import { useLinkStatus } from "next/link";
import styles from "./DoorPendingLine.module.css";

/** Thin signal-red progress under a door label while that Link is pending. */
export default function DoorPendingLine() {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`${styles.line} ${pending ? styles.pending : ""}`}
      aria-hidden="true"
    />
  );
}
