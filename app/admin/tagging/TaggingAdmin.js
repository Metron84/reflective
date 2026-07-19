"use client";

import { useState } from "react";
import VideosTab from "@/components/admin/tagging/VideosTab";
import VenuesTab from "@/components/admin/tagging/VenuesTab";
import FanGroupsTab from "@/components/admin/tagging/FanGroupsTab";

const TABS = [
  { id: "videos", label: "Videos" },
  { id: "venues", label: "Venues" },
  { id: "fan_groups", label: "Fan Groups" },
];

export default function TaggingAdmin({
  initialVenues,
  initialFanGroups,
  initialVideos,
}) {
  const [tab, setTab] = useState("videos");
  const [venues, setVenues] = useState(initialVenues);
  const [fanGroups, setFanGroups] = useState(initialFanGroups);
  const [videos, setVideos] = useState(initialVideos);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap gap-2 border-b border-navy/10 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-widest ${
              tab === t.id
                ? "bg-navy text-paper"
                : "border border-navy/20 text-navy/65"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "videos" ? (
          <VideosTab
            videos={videos}
            setVideos={setVideos}
            venues={venues}
            setVenues={setVenues}
            fanGroups={fanGroups}
            setFanGroups={setFanGroups}
          />
        ) : null}
        {tab === "venues" ? (
          <VenuesTab venues={venues} setVenues={setVenues} />
        ) : null}
        {tab === "fan_groups" ? (
          <FanGroupsTab fanGroups={fanGroups} setFanGroups={setFanGroups} />
        ) : null}
      </div>
    </div>
  );
}
