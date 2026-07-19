"use client";

import { useState } from "react";
import styles from "./ChatComposer.module.css";

export default function ChatComposer({ onSend, disabled }) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    onSend(text);
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className={styles.sr} htmlFor="concierge-input">
        Ask The Concierge
      </label>
      <input
        id="concierge-input"
        className={styles.input}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask about a venue or a film..."
        disabled={disabled}
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button
        type="submit"
        className={styles.send}
        disabled={disabled || !value.trim()}
      >
        Send
      </button>
    </form>
  );
}
