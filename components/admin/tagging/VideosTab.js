"use client";

import { useState } from "react";
import VideoForm from "./VideoForm";
import VideoList from "./VideoList";

export default function VideosTab({
  videos,
  setVideos,
  venues,
  setVenues,
  fanGroups,
  setFanGroups,
}) {
  const [mode, setMode] = useState("list"); // list | add | edit
  const [editing, setEditing] = useState(null);

  function upsertVideo(video) {
    setVideos((list) => {
      const next = [video, ...list.filter((v) => v.id !== video.id)];
      return next.sort((a, b) =>
        String(b.published_at ?? "").localeCompare(String(a.published_at ?? ""))
      );
    });
  }

  if (mode === "add" || mode === "edit") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setMode("list");
            setEditing(null);
          }}
          className="text-xs uppercase tracking-widest text-navy/55"
        >
          ← Back to list
        </button>
        <h2 className="font-display text-xl text-navy">
          {mode === "edit" ? "Edit video" : "Add video"}
        </h2>
        <VideoForm
          key={editing?.id ?? "new"}
          initial={editing}
          venues={venues}
          setVenues={setVenues}
          fanGroups={fanGroups}
          setFanGroups={setFanGroups}
          onCancel={() => {
            setMode("list");
            setEditing(null);
          }}
          onSaved={(video) => {
            upsertVideo(video);
            setEditing(video);
            setMode("edit");
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-navy">
          Videos ({videos.length})
        </h2>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setMode("add");
          }}
          className="rounded-full bg-signal px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-paper"
        >
          Add video
        </button>
      </div>
      <VideoList
        videos={videos}
        onEdit={(v) => {
          setEditing(v);
          setMode("edit");
        }}
      />
    </div>
  );
}
