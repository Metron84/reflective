"use client";

import { useState } from "react";
import UltimaInboxItem from "./UltimaInboxItem";
import styles from "./ultima.module.css";

export default function UltimaHubInbox({ preview = [], rest = [] }) {
  const [open, setOpen] = useState(false);
  const rows = open ? [...preview, ...rest] : preview;

  return (
    <>
      {rows.map((item) => (
        <UltimaInboxItem
          key={item.id}
          type={item.type}
          unread={item.unread}
          subject={item.subject}
          sender={item.sender}
          time={item.time}
          href={item.href || undefined}
        />
      ))}
      {!open && rest.length ? (
        <button type="button" className={styles.hubViewAll} onClick={() => setOpen(true)}>
          View all
        </button>
      ) : null}
    </>
  );
}
