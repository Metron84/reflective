"use client";

import { useMemo, useState } from "react";
import UltimaInboxItem from "./UltimaInboxItem";
import UltimaPanel from "./UltimaPanel";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

const FILTERS = [
  { id: "draft", label: "Draft" },
  { id: "trade", label: "Trade" },
  { id: "market", label: "Market" },
  { id: "admin", label: "Admin" },
];

function formatStamp(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function UltimaLogClient({ entries = [] }) {
  const [filter, setFilter] = useState(null);
  const rows = useMemo(
    () => (filter ? entries.filter((row) => row.category === filter) : entries),
    [entries, filter],
  );

  return (
    <div className={styles.utPage}>
      <nav className={styles.ruChips} aria-label="Log filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? styles.deskTabOn : styles.deskTab}
            onClick={() => setFilter((current) => (current === item.id ? null : item.id))}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <UltimaPanel title="Log">
        {rows.map((row) => (
          <UltimaInboxItem
            key={row.id}
            type={row.type}
            subject={row.reason ? `${row.action}. ${row.reason}` : row.action}
            sender={row.actor}
            time={formatStamp(row.at)}
            href={row.href}
          />
        ))}
        {rows.length === 0 ? (
          <UltimaStaffMessage
            subject="The log is empty"
            body="Commissioner and league actions land here when they happen."
          />
        ) : null}
      </UltimaPanel>
    </div>
  );
}
