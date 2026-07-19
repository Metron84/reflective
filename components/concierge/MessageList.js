import ResultRail from "./ResultRail";
import WriteToMeloCard from "./WriteToMeloCard";
import TypingIndicator from "./TypingIndicator";
import StarterChips from "./StarterChips";
import styles from "./MessageList.module.css";

function normalizeHandoff(value) {
  if (value === "full" || value === true) return "full";
  if (value === "light") return "light";
  return false;
}

export default function MessageList({
  messages,
  loading,
  onSeeVideos,
  onStarter,
  showStarters,
}) {
  const conversationForHandoff = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  return (
    <div className={styles.list} aria-live="polite">
      {messages.map((m, index) => {
        if (m.role === "user") {
          return (
            <div key={`u-${index}`} className={styles.userRow}>
              <div className={styles.userBubble}>{m.content}</div>
            </div>
          );
        }

        const lastUser = [...messages.slice(0, index)]
          .reverse()
          .find((x) => x.role === "user");
        const handoff = normalizeHandoff(m.handoff);
        const isLast = index === messages.length - 1;

        return (
          <div key={`a-${index}`} className={styles.assistantBlock}>
            <p className={styles.reply}>{m.content}</p>
            <ResultRail
              results={m.results}
              onSeeVideos={onSeeVideos}
              disabled={loading}
            />
            {handoff === "full" ? (
              <WriteToMeloCard
                variant="full"
                prefillMessage={lastUser?.content ?? ""}
                sourceConversation={conversationForHandoff}
              />
            ) : null}
            {handoff === "light" ? (
              <WriteToMeloCard
                variant="light"
                defaultTopic="Other"
                prefillMessage={lastUser?.content ?? ""}
                sourceConversation={conversationForHandoff}
              />
            ) : null}
            {handoff !== "full" &&
            (!m.results || m.results.length === 0) &&
            isLast &&
            showStarters ? (
              <div className={styles.chipsAfter}>
                <StarterChips onSelect={onStarter} disabled={loading} />
              </div>
            ) : null}
          </div>
        );
      })}

      {loading ? (
        <div className={styles.assistantBlock}>
          <TypingIndicator />
        </div>
      ) : null}
    </div>
  );
}
