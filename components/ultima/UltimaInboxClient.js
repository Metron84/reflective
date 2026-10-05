"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeLink } from "@/lib/ultima/notifications/rules";
import UltimaInboxItem from "./UltimaInboxItem";
import UltimaPanel from "./UltimaPanel";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

const TYPES = {
  trade_review: "trade",
  trade_executed: "trade",
  trade_vetoed: "trade",
  market_signing: "league",
  market_release: "league",
  shortlist_listed: "scout",
  broadcast: "staff",
};

function typeFor(kind) {
  if (TYPES[kind]) return TYPES[kind];
  if (String(kind).startsWith("offer_")) return "trade";
  return "staff";
}

function formatTime(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  });
}

async function postRead(payload) {
  try {
    const res = await fetch("/api/ultima/inbox/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function UltimaInboxClient({ initialItems = [] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const unread = items.filter((i) => !i.read_at).length;

  async function open(item) {
    if (!item.read_at) {
      setItems((list) =>
        list.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)),
      );
      await postRead({ id: item.id });
    }
    router.push(safeLink(item.link));
    router.refresh();
  }

  async function markAll() {
    setBusy(true);
    const ok = await postRead({ all: true });
    if (ok) {
      const now = new Date().toISOString();
      setItems((list) => list.map((i) => (i.read_at ? i : { ...i, read_at: now })));
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <UltimaPanel title="Inbox">
      <div className={styles.inboxHead}>
        <p className={styles.inboxHeadNote}>{unread > 0 ? `${unread} unread` : "All read"}</p>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={markAll}
          disabled={busy || unread === 0}
        >
          Mark all read
        </button>
      </div>
      {items.length === 0 ? (
        <UltimaStaffMessage
          subject="Nothing here yet"
          body="Offers, locks and league news land here."
        />
      ) : (
        items.map((item) => (
          <UltimaInboxItem
            key={item.id}
            type={typeFor(item.kind)}
            unread={!item.read_at}
            subject={item.title}
            sender={item.body}
            time={formatTime(item.created_at)}
            onClick={() => open(item)}
            tag={item.kind === "trade_review" && !item.read_at ? "Veto" : null}
          />
        ))
      )}
    </UltimaPanel>
  );
}
