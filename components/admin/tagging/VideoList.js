"use client";

import { youtubeThumbnailUrl } from "@/lib/films/youtube";

export default function VideoList({ videos, onEdit }) {
  return (
    <div className="space-y-2">
      {videos.map((v) => (
        <div
          key={v.id}
          className="flex gap-3 border border-navy/12 bg-white/30 p-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={youtubeThumbnailUrl(v.youtube_id) ?? undefined}
            alt=""
            className="h-16 w-28 shrink-0 object-cover bg-navy/10"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-navy">{v.title}</p>
            <p className="mt-0.5 text-xs text-navy/55">
              {v.venue?.name ?? "No venue"}
              {v.atmosphere_index != null
                ? ` · atmosphere ${v.atmosphere_index}/10`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onEdit(v)}
            className="shrink-0 self-center text-xs uppercase tracking-widest text-signal"
          >
            Edit
          </button>
        </div>
      ))}
      {videos.length === 0 ? (
        <p className="text-sm text-navy/50">No tagged videos yet.</p>
      ) : null}
    </div>
  );
}
