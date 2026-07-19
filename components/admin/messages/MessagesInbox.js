"use client";

import { useCallback, useState } from "react";
import AdminNav from "@/components/admin/AdminNav";
import styles from "./MessagesInbox.module.css";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "handled", label: "Handled" },
];

function firstLine(text) {
  const line = String(text ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean);
  if (!line) return "(empty)";
  return line.length > 100 ? `${line.slice(0, 97)}...` : line;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessagesInbox({
  initialMessages,
  initialNewCount,
  initialFilter = "all",
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [messages, setMessages] = useState(initialMessages);
  const [newCount, setNewCount] = useState(initialNewCount);
  const [selected, setSelected] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [conversationOpen, setConversationOpen] = useState(false);

  const loadList = useCallback(async (nextFilter) => {
    setLoadingList(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/messages?status=${encodeURIComponent(nextFilter)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Could not load messages.");
        return;
      }
      setMessages(data.messages ?? []);
      setNewCount(data.newCount ?? 0);
    } catch {
      setError("Could not load messages.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  async function onFilter(next) {
    setFilter(next);
    setSelected(null);
    setConversationOpen(false);
    await loadList(next);
  }

  async function patchStatus(id, status) {
    setError("");
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.message || "Could not update status.");
      return null;
    }
    return data.message;
  }

  async function openMessage(row) {
    setSelected(row);
    setConversationOpen(false);
    if (row.status !== "new") return;

    const updated = await patchStatus(row.id, "read");
    if (!updated) return;

    setSelected(updated);
    setNewCount((n) => Math.max(0, n - 1));
    setMessages((prev) => {
      if (filter === "new") {
        return prev.filter((m) => m.id !== row.id);
      }
      return prev.map((m) => (m.id === row.id ? { ...m, ...updated } : m));
    });
  }

  async function markHandled() {
    if (!selected) return;
    const updated = await patchStatus(selected.id, "handled");
    if (!updated) return;

    setSelected(updated);
    setMessages((prev) => {
      if (filter === "new") {
        return prev.filter((m) => m.id !== selected.id);
      }
      if (filter === "handled") {
        const exists = prev.some((m) => m.id === selected.id);
        if (exists) {
          return prev.map((m) =>
            m.id === selected.id ? { ...m, ...updated } : m
          );
        }
        return [updated, ...prev];
      }
      return prev.map((m) =>
        m.id === selected.id ? { ...m, ...updated } : m
      );
    });
  }

  const conversation = Array.isArray(selected?.source_conversation)
    ? selected.source_conversation
    : [];

  return (
    <div className={styles.page}>
      <AdminNav active="messages" newCount={newCount} />
      <header className={styles.header}>
        <p className={styles.eyebrow}>Admin</p>
        <h1 className={styles.title}>Messages</h1>
        <p className={styles.context}>Write to Melo inbox from The Concierge.</p>
      </header>

      <div className={styles.filters} role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? styles.filterActive : styles.filter}
            onClick={() => onFilter(f.id)}
            disabled={loadingList}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.layout}>
        <ul className={styles.list}>
          {messages.length === 0 ? (
            <li className={styles.empty}>No messages in this filter.</li>
          ) : (
            messages.map((row) => {
              const isNew = row.status === "new";
              const isSelected = selected?.id === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`${styles.row} ${isNew ? styles.rowNew : ""} ${
                      isSelected ? styles.rowSelected : ""
                    }`}
                    onClick={() => openMessage(row)}
                  >
                    <span className={styles.rowTop}>
                      {isNew ? (
                        <span className={styles.dot} aria-hidden="true" />
                      ) : (
                        <span className={styles.dotSpacer} aria-hidden="true" />
                      )}
                      <span className={styles.topic}>{row.topic}</span>
                      <span className={styles.status}>{row.status}</span>
                    </span>
                    <span className={styles.sender}>
                      {row.name?.trim() || "Anonymous"}
                    </span>
                    <span className={styles.preview}>{firstLine(row.message)}</span>
                    <span className={styles.date}>{formatDate(row.created_at)}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <section className={styles.detail} aria-live="polite">
          {!selected ? (
            <p className={styles.detailEmpty}>Select a message to read it.</p>
          ) : (
            <>
              <div className={styles.detailMeta}>
                <span className={styles.topic}>{selected.topic}</span>
                <span className={styles.status}>{selected.status}</span>
              </div>
              <p className={styles.detailName}>
                {selected.name?.trim() || "Anonymous"}
              </p>
              {selected.email ? (
                <p className={styles.detailEmail}>
                  <a href={`mailto:${selected.email}`}>{selected.email}</a>
                </p>
              ) : (
                <p className={styles.detailEmailMuted}>No email provided</p>
              )}
              <p className={styles.detailDate}>{formatDate(selected.created_at)}</p>
              <div className={styles.detailBody}>{selected.message}</div>
              {selected.status !== "handled" ? (
                <button
                  type="button"
                  className={styles.handledBtn}
                  onClick={markHandled}
                >
                  Mark handled
                </button>
              ) : null}

              {conversation.length > 0 ? (
                <div className={styles.conversation}>
                  <button
                    type="button"
                    className={styles.conversationToggle}
                    onClick={() => setConversationOpen((v) => !v)}
                    aria-expanded={conversationOpen}
                  >
                    {conversationOpen ? "Hide" : "Show"} conversation before this
                    message
                  </button>
                  {conversationOpen ? (
                    <ul className={styles.transcript}>
                      {conversation.map((turn, i) => (
                        <li
                          key={`${turn.role}-${i}`}
                          className={
                            turn.role === "user"
                              ? styles.turnUser
                              : styles.turnAssistant
                          }
                        >
                          <span className={styles.turnRole}>
                            {turn.role === "user" ? "Fan" : "Concierge"}
                          </span>
                          <p className={styles.turnText}>{turn.content}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
