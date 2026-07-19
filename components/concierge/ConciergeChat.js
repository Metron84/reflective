"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconConcierge } from "@/components/home/DoorIcons";
import ChatComposer from "./ChatComposer";
import MessageList from "./MessageList";
import StarterChips from "./StarterChips";
import WriteToMeloCard from "./WriteToMeloCard";
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
  const [showMelo, setShowMelo] = useState(false);
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
    setShowMelo(false);
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

  if (empty) {
    return (
      <div className={styles.emptyShell}>
        <div className={styles.emptyStage}>
          <span className={styles.compassMark} aria-hidden="true">
            <IconConcierge className={styles.compassIcon} />
          </span>
          <hr className={styles.hairlineFallback} aria-hidden="true" />
          <div className={styles.emptyGroup}>
            <p className={styles.emptyLead}>
              Tell me the night you&apos;re looking for, or the moment you want
              to find again.
            </p>
            <StarterChips onSelect={sendMessage} disabled={loading} />
            <ChatComposer
              onSend={sendMessage}
              disabled={loading}
              variant="empty"
              inputId="concierge-input-empty"
            />
            {!showMelo ? (
              <p className={styles.meloLinkWrap}>
                <button
                  type="button"
                  className={styles.meloLink}
                  onClick={() => setShowMelo(true)}
                >
                  Or write to Melo directly
                </button>
              </p>
            ) : (
              <div className={styles.meloForm}>
                <WriteToMeloCard
                  variant="full"
                  defaultTopic="Other"
                  prefillMessage=""
                  sourceConversation={[]}
                />
              </div>
            )}
            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.thread}>
        <MessageList
          messages={messages}
          loading={loading}
          onSeeVideos={(venueName) =>
            sendMessage(`Show me videos from ${venueName}`)
          }
          onStarter={sendMessage}
          showStarters={showChipsAfterNoResults}
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <div ref={bottomRef} />
      </div>
      <div className={styles.composerWrap}>
        <ChatComposer
          onSend={sendMessage}
          disabled={loading}
          variant="docked"
          inputId="concierge-input"
        />
      </div>
    </div>
  );
}
