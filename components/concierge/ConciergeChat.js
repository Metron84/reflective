"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatComposer from "./ChatComposer";
import MessageList from "./MessageList";
import StarterChips from "./StarterChips";
import styles from "./ConciergeChat.module.css";

function toApiMessages(messages) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export default function ConciergeChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const messagesRef = useRef(messages);
  const loadingRef = useRef(loading);
  messagesRef.current = messages;
  loadingRef.current = loading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const content = String(text ?? "").trim();
    if (!content || loadingRef.current) return;

    setError("");
    setLoading(true);

    const nextMessages = [
      ...messagesRef.current,
      { role: "user", content },
    ];
    setMessages(nextMessages);

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: toApiMessages(nextMessages) }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data?.message || "Something went wrong. Try again in a moment."
        );
        return;
      }

      const handoff =
        data.handoff === "full" || data.handoff === true
          ? "full"
          : data.handoff === "light"
            ? "light"
            : false;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.reply ||
            "The archive does not cover that yet. Try another angle, or ask Melo.",
          results: Array.isArray(data.results) ? data.results : [],
          handoff,
        },
      ]);
    } catch {
      setError("Something went wrong. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  const empty = messages.length === 0;
  const last = messages[messages.length - 1];
  const showChipsAfterNoResults =
    !loading &&
    last?.role === "assistant" &&
    last.handoff !== "full" &&
    (!last.results || last.results.length === 0);

  return (
    <div className={styles.shell}>
      <div className={styles.thread}>
        {empty ? (
          <div className={styles.empty}>
            <p className={styles.emptyLead}>
              Tell me what kind of night you want, or which film moment to find.
            </p>
            <StarterChips onSelect={sendMessage} disabled={loading} />
          </div>
        ) : (
          <MessageList
            messages={messages}
            loading={loading}
            onSeeVideos={(venueName) =>
              sendMessage(`Show me videos from ${venueName}`)
            }
            onStarter={sendMessage}
            showStarters={showChipsAfterNoResults}
          />
        )}
        {error ? <p className={styles.error}>{error}</p> : null}
        <div ref={bottomRef} />
      </div>
      <div className={styles.composerWrap}>
        <ChatComposer onSend={sendMessage} disabled={loading} />
      </div>
    </div>
  );
}
