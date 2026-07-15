"use client";

import { useState } from "react";

export default function ShareStatsButton({ shareText }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // fall through
      }
    }
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-full border border-navy/25 px-5 py-2 text-xs font-medium uppercase tracking-widest text-navy/80 transition-colors hover:border-navy/50 hover:text-navy"
    >
      {copied ? "Copied" : "Share my stats"}
    </button>
  );
}
