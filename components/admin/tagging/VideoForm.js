"use client";

import { useMemo, useState } from "react";
import { FIXTURE_TYPES, VIBE_TAGS } from "@/lib/admin/constants";
import { parseYoutubeId } from "@/lib/admin/youtube";
import VenueForm from "./VenueForm";
import FanGroupForm from "./FanGroupForm";
import MomentsEditor from "./MomentsEditor";

function blankForm() {
  return {
    youtube_id: "",
    title: "",
    published_at: "",
    fixture: "",
    fixture_date: "",
    fixture_type: "",
    competition: "",
    venue_id: "",
    atmosphere_index: 5,
    vibe_tags: [],
    languages: [],
    fan_group_ids: [],
    description: "",
  };
}

export default function VideoForm({
  initial = null,
  venues,
  setVenues,
  fanGroups,
  setFanGroups,
  onSaved,
  onCancel,
}) {
  const [urlInput, setUrlInput] = useState(
    initial?.youtube_id ? `https://www.youtube.com/watch?v=${initial.youtube_id}` : ""
  );
  const [form, setForm] = useState(
    initial
      ? {
          youtube_id: initial.youtube_id ?? "",
          title: initial.title ?? "",
          published_at: initial.published_at ?? "",
          fixture: initial.fixture ?? "",
          fixture_date: initial.fixture_date ?? "",
          fixture_type: initial.fixture_type ?? "",
          competition: initial.competition ?? "",
          venue_id: initial.venue_id ?? "",
          atmosphere_index: initial.atmosphere_index ?? 5,
          vibe_tags: initial.vibe_tags ?? [],
          languages: initial.languages ?? [],
          fan_group_ids: initial.fan_group_ids ?? [],
          description: initial.description ?? "",
        }
      : blankForm()
  );
  const [durationSeconds, setDurationSeconds] = useState(
    initial?.durationSeconds ?? null
  );
  const [fetchMsg, setFetchMsg] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [venueQuery, setVenueQuery] = useState("");
  const [langDraft, setLangDraft] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [showFanModal, setShowFanModal] = useState(false);

  const filteredVenues = useMemo(() => {
    const q = venueQuery.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.area && v.area.toLowerCase().includes(q))
    );
  }, [venues, venueQuery]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleTag(tag) {
    setForm((f) => ({
      ...f,
      vibe_tags: f.vibe_tags.includes(tag)
        ? f.vibe_tags.filter((t) => t !== tag)
        : [...f.vibe_tags, tag],
    }));
  }

  function toggleFanGroup(id) {
    setForm((f) => ({
      ...f,
      fan_group_ids: f.fan_group_ids.includes(id)
        ? f.fan_group_ids.filter((x) => x !== id)
        : [...f.fan_group_ids, id],
    }));
  }

  async function fetchMeta() {
    setFetching(true);
    setFetchMsg(null);
    const id = parseYoutubeId(urlInput);
    if (id) set("youtube_id", id);
    try {
      const res = await fetch("/api/admin/tagging/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.youtubeId) set("youtube_id", data.youtubeId);
      if (!data.ok) {
        setFetchMsg(data.message ?? "Couldn't fetch, enter title manually.");
        setDurationSeconds(null);
        return;
      }
      set("title", data.title || form.title);
      if (data.publishedAt) set("published_at", data.publishedAt);
      setDurationSeconds(
        data.durationSeconds != null ? data.durationSeconds : null
      );
      setFetchMsg("Title and date filled from YouTube.");
    } catch {
      setFetchMsg("Couldn't fetch, enter title manually.");
      setDurationSeconds(null);
    } finally {
      setFetching(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const youtube_id = parseYoutubeId(form.youtube_id || urlInput);
    if (!youtube_id) {
      setError("Paste a valid YouTube URL or id.");
      setPending(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/tagging/videos", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initial?.id,
          ...form,
          youtube_id,
          venue_id: form.venue_id || null,
          fixture_type: form.fixture_type || null,
          atmosphere_index: Number(form.atmosphere_index),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Could not save.");
        return;
      }
      onSaved?.({
        ...data.video,
        durationSeconds,
        venue: venues.find((v) => v.id === data.video.venue_id) ?? null,
      });
    } catch {
      setError("Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 border border-navy/15 bg-white/40 p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="YouTube URL or id"
          className="min-w-0 flex-1 border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
        />
        <button
          type="button"
          onClick={fetchMeta}
          disabled={fetching}
          className="rounded-full border border-navy/25 px-4 py-1.5 text-xs uppercase tracking-widest text-navy/80 disabled:opacity-50"
        >
          {fetching ? "Fetching…" : "Fetch from YouTube"}
        </button>
      </div>
      {fetchMsg ? <p className="text-sm text-navy/60">{fetchMsg}</p> : null}

      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-navy/60 sm:col-span-2">
            Title
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
            />
          </label>
          <label className="block text-xs text-navy/60">
            Published date
            <input
              type="date"
              value={form.published_at}
              onChange={(e) => set("published_at", e.target.value)}
              className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
            />
          </label>
          <label className="block text-xs text-navy/60">
            YouTube id
            <input
              value={form.youtube_id}
              onChange={(e) => set("youtube_id", e.target.value)}
              className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
            />
          </label>
          <label className="block text-xs text-navy/60">
            Fixture
            <input
              value={form.fixture}
              onChange={(e) => set("fixture", e.target.value)}
              placeholder="Japan v Brazil"
              className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
            />
          </label>
          <label className="block text-xs text-navy/60">
            Fixture date
            <input
              type="date"
              value={form.fixture_date}
              onChange={(e) => set("fixture_date", e.target.value)}
              className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
            />
          </label>
          <label className="block text-xs text-navy/60">
            Fixture type
            <select
              value={form.fixture_type}
              onChange={(e) => set("fixture_type", e.target.value)}
              className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
            >
              <option value="">-</option>
              {FIXTURE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-navy/60">
            Competition
            <input
              value={form.competition}
              onChange={(e) => set("competition", e.target.value)}
              className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
            />
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="block flex-1 text-xs text-navy/60">
              Venue search
              <input
                value={venueQuery}
                onChange={(e) => setVenueQuery(e.target.value)}
                placeholder="Filter venues"
                className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowVenueModal(true)}
              className="text-xs uppercase tracking-widest text-signal"
            >
              + New venue
            </button>
          </div>
          <select
            value={form.venue_id}
            onChange={(e) => set("venue_id", e.target.value)}
            className="mt-2 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          >
            <option value="">No venue</option>
            {filteredVenues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.area ? ` · ${v.area}` : ""}
              </option>
            ))}
          </select>
        </div>

        <label className="block text-xs text-navy/60">
          Atmosphere {form.atmosphere_index}/10
          <input
            type="range"
            min={1}
            max={10}
            value={form.atmosphere_index}
            onChange={(e) => set("atmosphere_index", Number(e.target.value))}
            className="mt-2 w-full"
          />
        </label>

        <div>
          <p className="text-xs text-navy/60">Vibe tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {VIBE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  form.vibe_tags.includes(tag)
                    ? "border-navy bg-navy text-paper"
                    : "border-navy/20 text-navy/70"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Custom tag"
              className="min-w-0 flex-1 border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
            />
            <button
              type="button"
              onClick={() => {
                const t = customTag.trim();
                if (!t) return;
                if (!form.vibe_tags.includes(t)) {
                  set("vibe_tags", [...form.vibe_tags, t]);
                }
                setCustomTag("");
              }}
              className="rounded-full border border-navy/25 px-3 py-1 text-xs uppercase tracking-widest text-navy/70"
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-navy/60">Languages</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.languages.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() =>
                  set(
                    "languages",
                    form.languages.filter((l) => l !== lang)
                  )
                }
                className="rounded-full border border-navy/20 px-2.5 py-1 text-xs text-navy/70"
              >
                {lang} ×
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={langDraft}
              onChange={(e) => setLangDraft(e.target.value)}
              placeholder="e.g. English"
              className="min-w-0 flex-1 border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
            />
            <button
              type="button"
              onClick={() => {
                const t = langDraft.trim();
                if (!t) return;
                if (!form.languages.includes(t)) {
                  set("languages", [...form.languages, t]);
                }
                setLangDraft("");
              }}
              className="rounded-full border border-navy/25 px-3 py-1 text-xs uppercase tracking-widest text-navy/70"
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-navy/60">Fan groups</p>
            <button
              type="button"
              onClick={() => setShowFanModal(true)}
              className="text-xs uppercase tracking-widest text-signal"
            >
              + New
            </button>
          </div>
          <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
            {fanGroups.map((fg) => (
              <button
                key={fg.id}
                type="button"
                onClick={() => toggleFanGroup(fg.id)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  form.fan_group_ids.includes(fg.id)
                    ? "border-navy bg-navy text-paper"
                    : "border-navy/20 text-navy/70"
                }`}
              >
                {fg.name}
              </button>
            ))}
            {fanGroups.length === 0 ? (
              <p className="text-sm text-navy/45">No fan groups yet.</p>
            ) : null}
          </div>
        </div>

        <label className="block text-xs text-navy/60">
          Description
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>

        {error ? <p className="text-sm text-signal">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-navy px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-paper disabled:opacity-50"
          >
            {pending ? "Saving…" : initial?.id ? "Update video" : "Save video"}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-navy/25 px-4 py-1.5 text-xs uppercase tracking-widest text-navy/70"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {initial?.id ? (
        <MomentsEditor
          videoId={initial.id}
          durationSeconds={durationSeconds}
        />
      ) : (
        <p className="text-sm text-navy/45">
          Save the video first to add moments.
        </p>
      )}

      {showVenueModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-paper p-4">
            <h3 className="font-display text-xl text-navy">New venue</h3>
            <div className="mt-3">
              <VenueForm
                onCancel={() => setShowVenueModal(false)}
                onSaved={(venue) => {
                  setVenues((list) =>
                    [...list.filter((v) => v.id !== venue.id), venue].sort(
                      (a, b) => a.name.localeCompare(b.name)
                    )
                  );
                  set("venue_id", venue.id);
                  setShowVenueModal(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {showFanModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-paper p-4">
            <h3 className="font-display text-xl text-navy">New fan group</h3>
            <div className="mt-3">
              <FanGroupForm
                onCancel={() => setShowFanModal(false)}
                onSaved={(fg) => {
                  setFanGroups((list) =>
                    [...list.filter((x) => x.id !== fg.id), fg].sort((a, b) =>
                      a.name.localeCompare(b.name)
                    )
                  );
                  setForm((f) => ({
                    ...f,
                    fan_group_ids: [...f.fan_group_ids, fg.id],
                  }));
                  setShowFanModal(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
