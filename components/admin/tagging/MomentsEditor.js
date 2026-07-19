"use client";

import { useEffect, useState } from "react";
import { MOMENT_TYPES } from "@/lib/admin/constants";
import { mmssToSeconds, secondsToMmss } from "@/lib/admin/youtube";

export default function MomentsEditor({ videoId, durationSeconds = null }) {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stamp, setStamp] = useState("");
  const [label, setLabel] = useState("");
  const [momentType, setMomentType] = useState("other");
  const [error, setError] = useState(null);
  const [warn, setWarn] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(
        `/api/admin/tagging/moments?video_id=${encodeURIComponent(videoId)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!cancelled) {
        setMoments(data.moments ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  function onStampChange(value) {
    setStamp(value);
    setWarn(null);
    const secs = mmssToSeconds(value);
    if (secs == null) return;
    if (secs < 0) {
      setWarn("Timestamp cannot be negative.");
      return;
    }
    if (
      durationSeconds != null &&
      Number.isFinite(durationSeconds) &&
      secs > durationSeconds
    ) {
      setWarn(
        `Past video length (${secondsToMmss(durationSeconds)}). You can still save.`
      );
    }
  }

  async function addMoment(e) {
    e.preventDefault();
    setError(null);
    const secs = mmssToSeconds(stamp);
    if (secs == null || secs < 0) {
      setError("Enter a valid timestamp (mm:ss).");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/admin/tagging/moments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          timestamp_seconds: secs,
          label,
          moment_type: momentType || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Could not add moment.");
        return;
      }
      setMoments((list) =>
        [...list, data.moment].sort(
          (a, b) => a.timestamp_seconds - b.timestamp_seconds
        )
      );
      setStamp("");
      setLabel("");
      setWarn(null);
    } catch {
      setError("Could not add moment.");
    } finally {
      setPending(false);
    }
  }

  async function removeMoment(id) {
    const res = await fetch(
      `/api/admin/tagging/moments?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMoments((list) => list.filter((m) => m.id !== id));
    }
  }

  return (
    <div className="mt-6 border-t border-navy/15 pt-4">
      <h3 className="font-display text-lg text-navy">Moments</h3>
      {loading ? (
        <p className="mt-2 text-sm text-navy/50">Loading…</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {moments.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-start justify-between gap-2 border border-navy/10 bg-white/30 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-navy">
                  {secondsToMmss(m.timestamp_seconds)}
                </span>
                <span className="mx-2 text-navy/35">·</span>
                <span className="text-navy/80">{m.label}</span>
                {m.moment_type ? (
                  <span className="ml-2 text-xs uppercase tracking-wider text-navy/40">
                    {m.moment_type}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeMoment(m.id)}
                className="text-xs uppercase tracking-widest text-signal"
              >
                Delete
              </button>
            </li>
          ))}
          {moments.length === 0 ? (
            <li className="text-sm text-navy/50">No moments yet.</li>
          ) : null}
        </ul>
      )}

      <form onSubmit={addMoment} className="mt-4 grid gap-2 sm:grid-cols-4">
        <label className="block text-xs text-navy/60">
          Timestamp
          <input
            value={stamp}
            onChange={(e) => onStampChange(e.target.value)}
            placeholder="1:23"
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>
        <label className="block text-xs text-navy/60 sm:col-span-2">
          Label
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="the place lifts after the equaliser"
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>
        <label className="block text-xs text-navy/60">
          Type
          <select
            value={momentType}
            onChange={(e) => setMomentType(e.target.value)}
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          >
            {MOMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-4">
          {warn ? <p className="text-sm text-amber-700">{warn}</p> : null}
          {error ? <p className="text-sm text-signal">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-full bg-navy px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-paper disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add moment"}
          </button>
        </div>
      </form>
    </div>
  );
}
