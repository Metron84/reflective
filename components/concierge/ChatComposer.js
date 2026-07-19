"use client";

import { useState } from "react";
import styles from "./ChatComposer.module.css";

export default function ChatComposer({
  onSend,
  disabled,
  variant = "docked",
  inputId = "concierge-input",
}) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    onSend(text);
  }

  return (
    <form
      className={`${styles.form} ${
        variant === "empty" ? styles.formEmpty : styles.formDocked
      }`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className={styles.sr} htmlFor={inputId}>
        Ask The Concierge
      </label>
      <input
        id={inputId}
        className={styles.input}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask about a venue, atmosphere, or film moment..."
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
